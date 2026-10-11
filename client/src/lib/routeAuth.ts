const protectedPathPrefixes = ["/account", "/dashboard", "/customers", "/settings"];

export function requiresAuthentication(pathname: string) {
  return protectedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
