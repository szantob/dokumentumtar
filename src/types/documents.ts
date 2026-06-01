export interface DocumentItem {
  key: string;
  name: string;
  category: string;
  subcategory: string | null;
  size: number;
  uploaded: Date;
  downloadUrl: string;
}
