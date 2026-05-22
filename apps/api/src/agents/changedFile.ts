export interface ChangedFile {
  path: string;
  content: string;
  patch: string;
  status: "added" | "modified" | "removed" | "renamed";
}
