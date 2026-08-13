/**
 * Static asset imports, resolved by Metro.
 *
 * These were typed `any`, which made them the only untyped surface in an otherwise
 * `any`-free codebase — an asset handle would silently satisfy any parameter at all.
 *
 * Metro turns a static image import into an opaque number: a handle into the asset
 * registry, not a path. `number` is the type React Native uses for exactly this, and it
 * is assignable to `ImageSourcePropType`, so `<Image source={icons.home} />` still
 * typechecks while `formatCurrency(icons.home)` no longer does.
 */
declare module '*.png' {
    const asset: number;
    export default asset;
}
declare module '*.jpg' {
    const asset: number;
    export default asset;
}
declare module '*.jpeg' {
    const asset: number;
    export default asset;
}
declare module '*.gif' {
    const asset: number;
    export default asset;
}
declare module '*.webp' {
    const asset: number;
    export default asset;
}
declare module '*.svg' {
    const asset: number;
    export default asset;
}
