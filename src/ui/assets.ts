import raw from "../data/asset-manifest.json";
export type AssetPath = string;
type FormAssets = { name: string; avatarPath?: AssetPath; battlePath?: AssetPath };
export const assetManifest = raw as {
  schemaVersion: number;
  forms: Record<string, FormAssets>;
  elements: Record<string, AssetPath>;
};
const names = new Map<string, FormAssets[]>();
for (const form of Object.values(assetManifest.forms))
  names.set(form.name, [...(names.get(form.name) || []), form]);
export function assetsForName(name: string) {
  const found = names.get(name);
  return found?.length === 1 ? found[0] : undefined;
}
