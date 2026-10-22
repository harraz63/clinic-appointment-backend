export interface PaginationInput {
    page?: number;
    limit?: number;
}

export interface Page<T> {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface Success<T> {
    status: 'success';
    data: T;
}
