export const reviewKeys = {
  all: ['review'] as const,
  items: (id: string) => [...reviewKeys.all, 'items', id] as const,
  duplicates: (id: string) => [...reviewKeys.all, 'duplicates', id] as const,
  image: (path: string) => [...reviewKeys.all, 'image', path] as const,
}
