const { createLogger, transports } = require("winston");
const { format } = require("logform/dist/browser");

// Environment variables used to configure the logger
const EnvOptions = {
    // Determine whether to log sensitive fields. Only "development" will log sensitive fields.
    ENVIRONMENT: process.env.NODE_ENV,

    // Options: debug, info, error (default: error)
    LOG_LEVEL: process.env.LOG_LEVEL,

    // Options: simple, json, logstash (default: json)
    LOG_FORMAT: process.env.LOG_FORMAT,

    // Path of logfile. Empty will disable logging to file.
    LOG_FILE: process.env.LOG_FILE,

    // Optionally set a custom level to log at when logging to file
    LOG_FILE_LEVEL: process.env.LOG_FILE_LEVEL
};

class Logger {

    constructor() {
        /**
         * Whether of not to print sensitive fields. Should only print sensitive fields in development.
         * @type {boolean}
         */
        this.printSenstive = EnvOptions.ENVIRONMENT === "development";

        const defaultLevel = EnvOptions.LOG_LEVEL ? EnvOptions.LOG_LEVEL : "error";

        // Configure formatters
        const formatters = [format.timestamp()];
        const logFormat = EnvOptions.LOG_FORMAT ? EnvOptions.LOG_FORMAT : "json";
        switch (logFormat) {
            case "simple":
                formatters.push(format.simple());
                break;
            case "logstash":
                formatters.push(format.logstash());
                break;
            case "json":
            default:
                formatters.push(format.json());
        }

        this.out = createLogger({
            level: defaultLevel,
            format: format.combine(...formatters),
            transports: [
                new transports.Console(),
            ]
        });

        if (EnvOptions.LOG_FILE) {
            this.out.add(new transports.File({
                filename: EnvOptions.LOG_FILE,
                level: EnvOptions.LOG_FILE_LEVEL ?  EnvOptions.LOG_FILE_LEVEL : defaultLevel
            }));
        }
    }

    /**
     * Append a field to the log
     * @param {string} name
     * @param {*} value
     * @returns {Context}
     */
    field(name, value) {
        return new Context(this).field(name, value);
    }

    /**
     * Append a sensitive field to the log. Sensitive field value will be omitted in non-development environments.
     * @param {string} name
     * @param {*} value
     * @returns {Context}
     */
    sensitiveField(name, value) {
        return new Context(this).sensitiveField(name, value);
    }

    /**
     * Capture an error
     * @param {Error} err
     * @returns {Context}
     */
    withError(err) {
        return new Context(this).withError(err);
    }

    /**
     * Print a message at the error level
     * @param {String} [message]
     * @param {*} [optionalParams]
     */
    error(message, ...optionalParams) {
        new Context(this).error(message, ...optionalParams);
    }

    /**
     * Print a message at the info level
     * @param {String} [message]
     * @param {*} [optionalParams]
     */
    info(message, ...optionalParams) {
        new Context(this).info(message, ...optionalParams);
    }

    /**
     * Print a message at the debug level
     * @param {String} [message]
     * @param {*} [optionalParams]
     */
    debug(message, ...optionalParams) {
        new Context(this).debug(message, ...optionalParams);
    }
}

class Context {

    /**
     * Construct a context
     * @param {Logger} logger
     */
    constructor(logger) {
        if (!logger) {
            throw new Error("context expected a logger");
        }

        /**
         * Logger to output logline
         * @type {Logger}
         * @private
         */
        this._logger = logger;

        /**
         * List of fields to include in logline
         * @type {Field[]}
         * @private
         */
        this._fields = [];
    }

    /**
     * Append a field to the log
     * @param {string} name
     * @param {*} value
     * @returns {Context}
     */
    field(name, value) {
        const field = new Field(name, value, false);
        this._fields.push(field);
        return this;
    }

    /**
     * Append a sensitive field to the log. Sensitive field value will be omitted if this.printSensitive is false.
     * @param {string} name
     * @param {*} value
     * @returns {Context}
     */
    sensitiveField(name, value) {
        const field = new Field(name, value, true);
        this._fields.push(field);
        return this;
    }

    /**
     * Capture an error
     * @param {Error} err
     * @returns {Context}
     */
    withError(err) {
        return this.field("error", err.toString());
    }

    /**
     * Print a message at the error level
     * @param {String} [message]
     * @param {*} [optionalParams]
     */
    error(message, ...optionalParams) {
        this._print("error", message, ...optionalParams);
    }

    /**
     * Print a message at the info level
     * @param {String} [message]
     * @param {*} [optionalParams]
     */
    info(message, ...optionalParams) {
        this._print("info", message, ...optionalParams);
    }

    /**
     * Print a message at the debug level
     * @param {String} [message]
     * @param {*} [optionalParams]
     */
    debug(message, ...optionalParams) {
        this._print("debug",message, ...optionalParams);
    }

    /**
     * Build the log entry and push it to the underlying logger library
     * @param {"error"|"info"|"debug"} level
     * @param {String} [message]
     * @param {*} [optionalParams]
     * @private
     */
    _print(level, message, ...optionalParams) {
        const entry = {
            level: level,
            message: message,
        };

        this._fields.forEach((field) => {
            let value = field.value;
            if (field.sensitive && !this._logger.printSenstive) {
                value = "";
            }
            entry[field.name] = value;
        });

        this._logger.out.log(entry)
    }
}

class Field {

    /**
     * Construct a field
     * @param {string} name
     * @param {*} value
     * @param {boolean} sensitive
     */
    constructor(name, value, sensitive) {
        /**
         * Field name
         * @type {string}
         */
        this.name = name;

        /**
         * Field value
         * @type {*}
         */
        this.value = this._serialiseValue(value);

        /**
         * Indicates whether the field value is sensitive
         * @type {boolean}
         */
        this.sensitive = sensitive;
    }

    /**
     * Serialise the field value
     * @returns {string}
     * @private
     */
    _serialiseValue (value) {
        const type = typeof value;
        switch (type) {
            case "object":
                return JSON.stringify(value);
            case "undefined":
                return "";
            default:
                return value;
        }
    }
}

module.exports = new Logger();