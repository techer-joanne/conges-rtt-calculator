import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '../../lib/utils';

/** Configuration shadcn/ui d'un graphique : libellé + couleur par clé de série. */
export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  }
>;

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error('useChart doit être utilisé dans <ChartContainer />');
  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = 'ChartContainer';

/** Injecte les couleurs de la config sous forme de variables CSS --color-<clé>. */
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, c]) => c.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colorConfig
          .map(([key, c]) => (c.color ? `  --color-${key}: ${c.color};` : null))
          .filter(Boolean)
          .join('\n')}\n}`,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipContentProps = {
  active?: boolean;
  payload?: Array<{
    name?: string | number;
    value?: number | string;
    dataKey?: string | number;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: React.ReactNode;
  hideLabel?: boolean;
  labelFormatter?: (value: React.ReactNode) => React.ReactNode;
  formatter?: (value: number | string, name: string) => React.ReactNode;
  className?: string;
};

const ChartTooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ active, payload, label, hideLabel = false, labelFormatter, formatter, className }, ref) => {
    const { config } = useChart();
    if (!active || !payload?.length) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-xl',
          className,
        )}
      >
        {!hideLabel && label != null && (
          <p className="font-semibold text-foreground">
            {labelFormatter ? labelFormatter(label) : label}
          </p>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = String(item.dataKey ?? item.name ?? index);
            const itemConfig = config[key];
            const indicatorColor = item.color || `var(--color-${key})`;
            const name = itemConfig?.label ?? item.name ?? key;
            return (
              <div key={index} className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: indicatorColor }}
                  />
                  <span className="text-muted-foreground">{name}</span>
                </div>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatter && item.value != null
                    ? formatter(item.value, String(name))
                    : item.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

const ChartLegend = RechartsPrimitive.Legend;

type LegendContentProps = {
  payload?: Array<{ value?: string; color?: string; dataKey?: string | number }>;
  className?: string;
};

const ChartLegendContent = React.forwardRef<HTMLDivElement, LegendContentProps>(
  ({ payload, className }, ref) => {
    const { config } = useChart();
    if (!payload?.length) return null;
    return (
      <div ref={ref} className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3', className)}>
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.value ?? index);
          const itemConfig = config[key];
          return (
            <div key={index} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
              {itemConfig?.label ?? item.value}
            </div>
          );
        })}
      </div>
    );
  },
);
ChartLegendContent.displayName = 'ChartLegendContent';

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
