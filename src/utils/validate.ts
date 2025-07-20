import { openPkgSchema } from "../types/openpkg";

export function validateOpenPkg(data: any) {
  const result = openPkgSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Invalid OpenPkg spec: ${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
  return result.data;
}
