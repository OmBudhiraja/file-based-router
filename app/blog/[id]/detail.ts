function handler(req: Request, params: Record<string, string>) {
  return new Response('Blog unique id Page detail page with id:' + params.id);
}

export default handler;
