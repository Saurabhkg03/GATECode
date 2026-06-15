import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
    success: false;
    code: string;
    message: string;
    details?: any;
}

export interface ApiSuccessResponse<T = any> {
    success: true;
    data?: T;
    [key: string]: any; // Allow flat spreading if preferred
}

/**
 * Standardizes API error responses across the application
 */
export function apiError(message: string, code: string = 'INTERNAL_ERROR', status: number = 500, details?: any) {
    const payload: ApiErrorResponse = {
        success: false,
        code,
        message,
    };
    if (details) {
        payload.details = details;
    }
    return NextResponse.json(payload, { status });
}

/**
 * Standardizes API success responses across the application
 */
export function apiSuccess<T>(data?: T, status: number = 200) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        // If data is an object, we spread it flat into the payload for backwards compatibility 
        // with existing frontend assumptions (e.g., responses like { success: true, warning: '...' })
        return NextResponse.json({ success: true, ...data }, { status });
    }
    return NextResponse.json({ success: true, data }, { status });
}
