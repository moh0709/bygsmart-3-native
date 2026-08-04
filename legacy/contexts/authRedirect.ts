const normalizeBasePath = (basePath: string): string => {
    const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
};

export const buildBaseRedirectUrl = (origin: string, basePath: string): string => {
    return new URL(normalizeBasePath(basePath), origin).toString();
};

export const buildHashRouteRedirectUrl = (
    origin: string,
    basePath: string,
    route: string
): string => {
    const baseWithSlash = normalizeBasePath(basePath);
    const routeWithSlash = route.startsWith('/') ? route : `/${route}`;

    return new URL(`${baseWithSlash}#${routeWithSlash}`, origin).toString();
};
