type SchemaProperty = { type?: string | string[]; anyOf?: SchemaProperty[] };
export function omitStoredNull(value: unknown, property: SchemaProperty, required: boolean): boolean {
  const allowsNull = (entry: SchemaProperty): boolean =>
    entry.type === "null" ||
    (Array.isArray(entry.type) && entry.type.includes("null")) ||
    !!entry.anyOf?.some(allowsNull);
  return value === null && !required && !allowsNull(property);
}
