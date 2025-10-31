// Middleware для преобразования BigInt в Number во всех ответах
export const bigIntMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    const convertedData = convertBigIntToNumber(data);
    originalJson.call(this, convertedData);
  };

  next();
};

// Рекурсивная функция для преобразования BigInt
function convertBigIntToNumber(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }

  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = convertBigIntToNumber(obj[key]);
      }
    }
    return newObj;
  }

  return obj;
}