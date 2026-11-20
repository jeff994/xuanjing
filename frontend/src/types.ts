export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  coverUrl: string | null;
  downloadUrl: string;
  uploadedBy: number;
  uploaderUsername: string;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: number;
  bookId: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
}
