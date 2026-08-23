declare module "robots-parser" {
  interface Robots {
    isAllowed(url: string, userAgent?: string): boolean | undefined;
    getSitemaps(): string[];
  }
  function robotsParser(url: string, contents: string): Robots;
  export default robotsParser;
}
