// Ambient declarations for CSS and static assets
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

