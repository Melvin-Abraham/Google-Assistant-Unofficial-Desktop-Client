/**
 * Serializes `obj` into a string. Throws error if the
 * provided object is not serializable
 *
 * @param obj
 */
export function serialize(obj: any) {
  if (typeof obj === 'object') {
    // If type of `obj` is an object, try serializing as a JSON object

    try {
      return JSON.stringify(obj);
    }
    catch (err) {
      // If object is not serializable, perhaps due to circular structure,
      // throw an error
      throw Error(`Serialization failed: Non-serializable data passed to the request object\n${err}`);
    }
  }

  if (typeof obj !== 'string') {
    // Strings are considered serialized
    // If `obj` is neither an object nor a string, throw an exception
    throw Error('Serialization failed: Non-serializable data passed to the request object');
  }

  return obj;
}
