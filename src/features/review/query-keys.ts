export const reviewKeys = {
  all: ['review'] as const,
  receipt: (id: string) => [...reviewKeys.all, 'receipt', id] as const,
  items: (id: string) => [...reviewKeys.all, 'items', id] as const,
  image: (path: string) => [...reviewKeys.all, 'image', path] as const,
}
