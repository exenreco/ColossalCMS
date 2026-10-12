export interface ViewSeries {
  current: number;
  previous: number;
  currentSeries: number[];
  previousSeries: number[];
}
export interface ViewAnalytics {
  start: string;
  end: string;
  previousStart: string;
  labels: string[];
  previousLabels: string[];
  page: ViewSeries;
  post: ViewSeries;
}
