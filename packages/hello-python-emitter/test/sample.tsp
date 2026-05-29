/** Sample TypeSpec used to exercise every renderer. */
namespace HelloService;

model Widget {
  id: string;
  name: string;
  weight: int32;
  color?: string;
}

model WidgetList {
  items: Widget[];
  nextLink?: string;
}

op list(): WidgetList;
op get(id: string): Widget;
op create(widget: Widget): Widget;
op delete(id: string): void;
op ping(): string;
