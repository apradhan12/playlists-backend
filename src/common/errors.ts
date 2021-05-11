export class GeneralError extends Error {
    constructor(message: string) {
        super();
        this.message = message;
    }

    getCode() {
        return 500;
    }
}

export class Unauthorized extends GeneralError {
    getCode() {
        return 401;
    }
}

export class BadRequest extends GeneralError {
    getCode() {
        return 400;
    }
}
export class NotFound extends GeneralError {
    getCode() {
        return 404;
    }
}
