export interface save_data {
  userList: number[];
}

export interface fileQ {
  [index: string]: string;
}

export type Data = [string, string, string];

export type Next = () => void | Promise<void>;

export interface user {
  id: number;
  searchData: Data[];
  searchBool: boolean;
  filterBool: boolean;
}
