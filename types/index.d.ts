declare module "json-server" {
  export function createServer(): any
  export function router(dbPath: string): any
  export function defaults(options?: any): any
  export const bodyParser: any
}
