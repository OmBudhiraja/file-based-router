function handler(req: Request, params: Record<string, string>) {
  return new Response('Blog unique id Page with id:' + params.id);
}

export default handler;
