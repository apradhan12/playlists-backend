export abstract class GeneralError extends Error {
    protected constructor(message: string) {
        super();
        this.message = message;
    }
}

export class Unauthorized extends GeneralError {
    code: number;
    constructor(message: string) {
        super(message);
        this.code = 401;
    }
}

export class Conflict extends GeneralError {
    code: number;
    constructor(message: string) {
        super(message);
        this.code = 409;
    }
}

export class BadRequest extends GeneralError {
    code: number;
    constructor(message: string) {
        super(message);
        this.code = 400;
    }
}

export class NotFound extends GeneralError {
    code: number;
    constructor(message: string) {
        super(message);
        this.code = 404;
    }
}
