"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataValidationError = exports.DEFAULT_MIN_CANDLES = exports.detectGaps = exports.sortAndDetectOutOfOrder = exports.checkDuplicateTimestamps = exports.validateCandleSeries = exports.isCandleCorrupted = exports.validateCandle = void 0;
var candleValidator_1 = require("./candleValidator");
Object.defineProperty(exports, "validateCandle", { enumerable: true, get: function () { return candleValidator_1.validateCandle; } });
Object.defineProperty(exports, "isCandleCorrupted", { enumerable: true, get: function () { return candleValidator_1.isCandleCorrupted; } });
var seriesValidator_1 = require("./seriesValidator");
Object.defineProperty(exports, "validateCandleSeries", { enumerable: true, get: function () { return seriesValidator_1.validateCandleSeries; } });
Object.defineProperty(exports, "checkDuplicateTimestamps", { enumerable: true, get: function () { return seriesValidator_1.checkDuplicateTimestamps; } });
Object.defineProperty(exports, "sortAndDetectOutOfOrder", { enumerable: true, get: function () { return seriesValidator_1.sortAndDetectOutOfOrder; } });
Object.defineProperty(exports, "detectGaps", { enumerable: true, get: function () { return seriesValidator_1.detectGaps; } });
Object.defineProperty(exports, "DEFAULT_MIN_CANDLES", { enumerable: true, get: function () { return seriesValidator_1.DEFAULT_MIN_CANDLES; } });
var types_1 = require("./types");
Object.defineProperty(exports, "DataValidationError", { enumerable: true, get: function () { return types_1.DataValidationError; } });
//# sourceMappingURL=index.js.map