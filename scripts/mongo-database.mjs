import { MongoClient } from "mongodb";
import { configureMongoDNS } from "./mongo-dns.mjs";
import {
  productionSchema,
  mongoValidator,
  rowDefaults,
} from "./production-schema.mjs";

// Translate the CMS's deliberately small prepared SQL grammar to native Mongo operations.
// Unsupported SQL fails explicitly instead of silently returning a different result.
export function sqlTokens(sql) {
  const tokens = [];
  const pattern =
    /\s+|(?:'[^']*(?:''[^']*)*')|\?|!=|<>|>=|<=|[(),.*=<>+]|[A-Za-z_][\w]*|-?\d+/gy;
  let position = 0;
  while (position < sql.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(sql);
    if (!match) throw new Error("Unsupported database statement.");
    position = pattern.lastIndex;
    if (!/^\s+$/.test(match[0])) tokens.push(match[0]);
  }
  return tokens;
}

export function parseSql(sql, args = []) {
  const tokens = sqlTokens(sql);
  let cursor = 0,
    bound = 0;
  const peek = () => tokens[cursor]?.toUpperCase();
  const take = () => tokens[cursor++];
  const eat = (value) => {
    if (peek() !== value) throw new Error("Unsupported database statement.");
    take();
  };
  const name = () => {
    const token = take();
    if (!/^[a-z_][\w]*$/i.test(token || ""))
      throw new Error("Invalid database identifier.");
    return token;
  };
  const field = () => {
    let result = name();
    if (peek() === ".") {
      take();
      result += "." + (peek() === "*" ? take() : name());
    }
    return result;
  };
  const value = () => {
    const token = take();
    if (token === "?") {
      if (bound >= args.length) throw new Error("Missing bound parameter.");
      return args[bound++];
    }
    if (token?.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'");
    if (token?.toUpperCase() === "NULL") return null;
    if (/^-?\d+$/.test(token || "")) return Number(token);
    throw new Error("Unsupported database value.");
  };
  const atom = () => {
    if (peek() === "(") {
      take();
      const result = or();
      eat(")");
      return result;
    }
    const key = field(),
      op = take();
    if (op === "IS") {
      const negate = peek() === "NOT";
      if (negate) take();
      eat("NULL");
      return { [key]: { [negate ? "$ne" : "$eq"]: null } };
    }
    const val = value();
    const operators = {
      "=": "$eq",
      "!=": "$ne",
      "<>": "$ne",
      ">": "$gt",
      "<": "$lt",
      ">=": "$gte",
      "<=": "$lte",
    };
    if (!operators[op]) throw new Error("Unsupported database comparison.");
    return { [key]: { [operators[op]]: val } };
  };
  const and = () => {
    const list = [atom()];
    while (peek() === "AND") {
      take();
      list.push(atom());
    }
    return list.length === 1 ? list[0] : { $and: list };
  };
  const or = () => {
    const list = [and()];
    while (peek() === "OR") {
      take();
      list.push(and());
    }
    return list.length === 1 ? list[0] : { $or: list };
  };
  const where = () => {
    if (peek() !== "WHERE") return {};
    take();
    return or();
  };
  const kind = take()?.toUpperCase();
  let result;
  if (kind === "SELECT") {
    const columns = [];
    do {
      if (peek() === ",") take();
      columns.push(peek() === "*" ? take() : field());
    } while (peek() === ",");
    eat("FROM");
    const table = name();
    let alias;
    if (peek() && !["WHERE", "ORDER", "LIMIT", "JOIN"].includes(peek()))
      alias = name();
    let join;
    if (peek() === "JOIN") {
      take();
      const joined = name(),
        joinAlias = name();
      eat("ON");
      const left = field();
      eat("=");
      const right = field();
      join = { table: joined, alias: joinAlias, left, right };
    }
    const filter = where();
    const sort = {};
    if (peek() === "ORDER") {
      take();
      eat("BY");
      do {
        if (peek() === ",") take();
        const key = field();
        sort[key] =
          peek() === "DESC" ? (take(), -1) : (peek() === "ASC" && take(), 1);
      } while (peek() === ",");
    }
    let limit;
    if (peek() === "LIMIT") {
      take();
      limit = value();
      if (!Number.isInteger(limit) || limit < 1)
        throw new Error("Invalid query limit.");
    }
    result = { kind, table, columns, filter, sort, limit, alias, join };
  } else if (kind === "INSERT") {
    let ignore = false;
    if (peek() === "OR") {
      take();
      eat("IGNORE");
      ignore = true;
    }
    eat("INTO");
    const table = name();
    eat("(");
    const columns = [];
    do {
      if (peek() === ",") take();
      columns.push(name());
    } while (peek() === ",");
    eat(")");
    const fromSelect = peek() === "SELECT";
    eat(fromSelect ? "SELECT" : "VALUES");
    if (!fromSelect) eat("(");
    const values = [];
    do {
      if (peek() === ",") take();
      values.push(value());
    } while (peek() === ",");
    if (!fromSelect) eat(")");
    let source;
    if (fromSelect) {
      eat("FROM");
      source = { table: name(), filter: where() };
    }
    if (columns.length !== values.length)
      throw new Error("Invalid insert values.");
    let conflict,
      updates = {};
    if (peek() === "ON") {
      take();
      eat("CONFLICT");
      eat("(");
      conflict = name();
      eat(")");
      eat("DO");
      eat("UPDATE");
      eat("SET");
      do {
        if (peek() === ",") take();
        const key = name();
        eat("=");
        if (peek() === "EXCLUDED") {
          take();
          eat(".");
          const source = name();
          if (!columns.includes(source))
            throw new Error("Unknown excluded column.");
          updates[key] = values[columns.indexOf(source)];
        } else updates[key] = value();
      } while (peek() === ",");
    }
    result = {
      kind,
      table,
      row: Object.fromEntries(columns.map((c, i) => [c, values[i]])),
      ignore,
      conflict,
      updates,
      source,
    };
  } else if (kind === "UPDATE") {
    const table = name();
    eat("SET");
    const updates = {};
    const increments = {};
    do {
      if (peek() === ",") take();
      const key = name();
      eat("=");
      if (peek() === key.toUpperCase()) {
        take();
        eat("+");
        increments[key] = value();
      } else updates[key] = value();
    } while (peek() === ",");
    result = { kind, table, updates, increments, filter: where() };
  } else if (kind === "DELETE") {
    eat("FROM");
    const table = name();
    result = { kind, table, filter: where() };
  } else throw new Error("Unsupported database statement.");
  if (cursor !== tokens.length || bound !== args.length)
    throw new Error("Unsupported database statement or parameters.");
  return result;
}

export function mongoAdapter(client, database, schema = productionSchema()) {
  async function execute(sql, args, session) {
    const q = parseSql(sql, args);
    if (!schema[q.table]) throw new Error("Unknown CMS collection.");
    const collection = database.collection(q.table),
      options = session ? { session } : {};
    if (q.kind === "SELECT") {
      let rows;
      if (q.join) {
        if (!schema[q.join.table])
          throw new Error("Unknown joined collection.");
        const ref = (f) => f.split(".")[1];
        const local = q.join.left.startsWith(q.alias + ".")
          ? q.join.left
          : q.join.right;
        const foreign = local === q.join.left ? q.join.right : q.join.left;
        const removeAlias = (filter) =>
          Object.fromEntries(
            Object.entries(filter).map(([k, v]) => [
              k.startsWith(q.alias + ".") ? k.slice(q.alias.length + 1) : k,
              Array.isArray(v) ? v.map(removeAlias) : v,
            ]),
          );
        const pipeline = [
          {
            $lookup: {
              from: q.join.table,
              localField: ref(local),
              foreignField: ref(foreign),
              as: q.join.alias,
            },
          },
          { $unwind: "$" + q.join.alias },
          { $match: removeAlias(q.filter) },
        ];
        rows = await collection.aggregate(pipeline, options).toArray();
      } else {
        let query = collection.find(q.filter, options);
        if (Object.keys(q.sort).length) query = query.sort(q.sort);
        if (q.limit) query = query.limit(q.limit);
        rows = await query.toArray();
      }
      return {
        results: rows.map((row) => {
          const clean = { ...row };
          delete clean._id;
          if (q.columns.includes("*")) return clean;
          const out = {};
          for (const c of q.columns) {
            if (c === q.alias + ".*") {
              Object.assign(out, clean);
              if (q.join) delete out[q.join.alias];
            } else {
              const [a, b] = c.split(".");
              out[b || a] = b ? (a === q.alias ? row[b] : row[a]?.[b]) : row[a];
            }
          }
          return out;
        }),
      };
    }
    if (q.kind === "INSERT") {
      if (q.source) {
        if (!schema[q.source.table])
          throw new Error("Unknown CMS source collection.");
        const exists = await database
          .collection(q.source.table)
          .findOne(q.source.filter, options);
        if (!exists) return { meta: { changes: 0 } };
      }
      const row = { ...rowDefaults(schema[q.table]), ...q.row };
      if (q.ignore) {
        const unique = schema[q.table].indexes
          .filter((i) => i.unique)
          .map((i) => Object.fromEntries(i.fields.map((f) => [f, row[f]])));
        if (await collection.findOne({ $or: unique }, options))
          return { meta: { changes: 0 } };
        const r = await collection.updateOne(
          { id: row.id },
          { $setOnInsert: row },
          { ...options, upsert: true },
        );
        return { meta: { changes: r.upsertedCount } };
      }
      if (q.conflict) {
        const insertOnly = Object.fromEntries(
          Object.entries(row).filter(([k]) => !(k in q.updates)),
        );
        const r = await collection.updateOne(
          { [q.conflict]: q.row[q.conflict] },
          { $set: q.updates, $setOnInsert: insertOnly },
          { ...options, upsert: true },
        );
        return { meta: { changes: r.matchedCount + r.upsertedCount } };
      }
      try {
        await collection.insertOne(row, options);
        return { meta: { changes: 1 } };
      } catch (e) {
        if (q.ignore && e.code === 11000) return { meta: { changes: 0 } };
        throw e;
      }
    }
    const r =
      q.kind === "UPDATE"
        ? await collection.updateMany(
            q.filter,
            {
              $set: q.updates,
              ...(Object.keys(q.increments).length
                ? { $inc: q.increments }
                : {}),
            },
            options,
          )
        : await collection.deleteMany(q.filter, options);
    return { meta: { changes: r.matchedCount ?? r.deletedCount } };
  }
  const prepared = (sql, args = []) => ({
    sql,
    args,
    bind: (...values) => prepared(sql, values),
    all: () => execute(sql, args),
    first: async () => (await execute(sql, args)).results[0] || null,
    run: () => execute(sql, args),
  });
  return {
    prepare: prepared,
    batch: async (statements) => {
      const session = client.startSession();
      try {
        return await session.withTransaction(async () => {
          const result = [];
          for (const s of statements)
            result.push(await execute(s.sql, s.args, session));
          return result;
        });
      } finally {
        await session.endSession();
      }
    },
    close: () => client.close(),
  };
}

export async function connectMongo(config, log = () => {}, initialize = true) {
  configureMongoDNS(config, log);
  const client = new MongoClient(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  try {
    log("Connecting to MongoDB…");
    await client.connect();
    const database = client.db(config.MONGODB_DATABASE);
    await database.command({ ping: 1 });
    log("MongoDB ping succeeded.");
    const hello = await database.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid")
      throw Object.assign(
        new Error(
          "MongoDB requires a replica set or Atlas for atomic CMS transactions.",
        ),
        { code: "CMS_MONGO_REPLICA_SET" },
      );
    const schema = productionSchema();
    if (initialize) {
      const existing = new Set(
        (await database.listCollections({}, { nameOnly: true }).toArray()).map(
          (c) => c.name,
        ),
      );
      for (const [name, table] of Object.entries(schema)) {
        if (!existing.has(name)) {
          await database.createCollection(name, {
            validator: mongoValidator(table),
          });
          log("Created collection: " + name);
        } else {
          await database.command({
            collMod: name,
            validator: mongoValidator(table),
            validationLevel: "strict",
          });
          log("Validated schema: " + name);
        }
        for (const index of table.indexes) {
          await database
            .collection(name)
            .createIndex(Object.fromEntries(index.fields.map((f) => [f, 1])), {
              unique: index.unique,
              name: index.name.replace(/^sqlite_autoindex_/, "cms_"),
            });
          log("Ensured index: " + name + " / " + index.fields.join(", "));
        }
      }
    }
    return mongoAdapter(client, database, schema);
  } catch (e) {
    await client.close().catch(() => {});
    throw e;
  }
}
