export const dashboardKeys = {
  all: ['dashboard'] as const,
  totals: (from: string) => [...dashboardKeys.all, 'totals', from] as const,
  groups: (from: string) => [...dashboardKeys.all, 'groups', from] as const,
  hotspots: (from: string) => [...dashboardKeys.all, 'hotspots', from] as const,
  goal: () => [...dashboardKeys.all, 'goal'] as const,
}
