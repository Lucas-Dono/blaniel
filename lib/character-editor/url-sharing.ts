import { CharacterConfig } from './sutemo-assets';

/**
 * Codifica la configuración del personaje en la URL
 */
export function encodeConfigToURL(config: CharacterConfig): string {
  const params = new URLSearchParams({
    bt: config.bodyType,
    hf: config.hairFrontStyle,
    hb: config.hairBehindStyle,
    hc: config.hairColor,
    ex: config.expression,
    of: config.outfit,
    bl: config.blush,
    ac: config.accessory,
  });

  return params.toString();
}

/**
 * Decodifica la configuración del personaje desde la URL
 */
export function decodeConfigFromURL(search: string): Partial<CharacterConfig> | null {
  try {
    const params = new URLSearchParams(search);

    const config: Partial<CharacterConfig> = {};

    // Read parameters
    const bt = params.get('bt');
    const hf = params.get('hf');
    const hb = params.get('hb');
    const hc = params.get('hc');
    const ex = params.get('ex');
    const of = params.get('of');
    const bl = params.get('bl');
    const ac = params.get('ac');

    // Body type (default female-halfbody if not specified)
    if (bt) {
      config.bodyType = bt as CharacterConfig['bodyType'];
    }

    // Backward compatibility: read old 'hs' and use for both styles
    const hs = params.get('hs');
    if (hs && !hf && !hb) {
      config.hairFrontStyle = hs as CharacterConfig['hairFrontStyle'];
      config.hairBehindStyle = (hs === '4' ? '0' : hs) as CharacterConfig['hairBehindStyle'];
    }

    if (hf) config.hairFrontStyle = hf as CharacterConfig['hairFrontStyle'];
    if (hb) config.hairBehindStyle = hb as CharacterConfig['hairBehindStyle'];
    if (hc) config.hairColor = hc as CharacterConfig['hairColor'];

    // Migrar 'Layer-16' a 'Green-eyes'
    if (ex) {
      config.expression = (ex === 'Layer-16' ? 'Green-eyes' : ex) as CharacterConfig['expression'];
    }

    if (of) config.outfit = of as CharacterConfig['outfit'];
    if (bl) config.blush = bl as CharacterConfig['blush'];
    if (ac) config.accessory = ac as CharacterConfig['accessory'];

    return Object.keys(config).length > 0 ? config : null;
  } catch {
    return null;
  }
}

/**
 * Copia la URL con la configuración al portapapeles
 */
export async function copyConfigURL(config: CharacterConfig): Promise<boolean> {
  try {
    const encoded = encodeConfigToURL(config);
    const url = `${window.location.origin}${window.location.pathname}?${encoded}`;

    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
