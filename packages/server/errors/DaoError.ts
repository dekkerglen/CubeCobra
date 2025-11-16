import { AppError, AppErrorParams } from "./AppError";
import { ErrorCode } from "./errorCodes";

interface DaoErrorParams extends AppErrorParams { }

export class DaoError extends AppError {
    constructor(
        message: string,
        public code: ErrorCode,
        params?: DaoErrorParams
    ) {
        super(message, code, params);
        this.name = "DaoError";
    }
}