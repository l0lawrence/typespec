/** Larger sample (~30 ops / ~12 models) to make per-renderer timings meaningful. */
namespace HelloService;

model Address {
  street: string;
  city: string;
  zip: string;
  country?: string;
}

model Person {
  id: string;
  name: string;
  age: int32;
  email?: string;
  address?: Address;
}

model Widget {
  id: string;
  name: string;
  weight: int32;
  color?: string;
  owner?: Person;
}

model WidgetList { items: Widget[]; nextLink?: string; }
model PersonList { items: Person[]; nextLink?: string; }
model AddressList { items: Address[]; nextLink?: string; }

model Order { id: string; items: Widget[]; total: float64; placedBy?: Person; }
model OrderList { items: Order[]; nextLink?: string; }

model Invoice { id: string; order: Order; paid: boolean; amount: float64; }
model InvoiceList { items: Invoice[]; nextLink?: string; }

model Tag { name: string; value?: string; }
model SearchResult { matches: Widget[]; total: int32; }

op listWidgets(): WidgetList;
op getWidget(id: string): Widget;
op createWidget(widget: Widget): Widget;
op updateWidget(id: string, widget: Widget): Widget;
op deleteWidget(id: string): void;
op searchWidgets(q: string, limit?: int32): SearchResult;

op listPersons(): PersonList;
op getPerson(id: string): Person;
op createPerson(person: Person): Person;
op updatePerson(id: string, person: Person): Person;
op deletePerson(id: string): void;

op listAddresses(): AddressList;
op getAddress(id: string): Address;
op createAddress(address: Address): Address;
op deleteAddress(id: string): void;

op listOrders(): OrderList;
op getOrder(id: string): Order;
op createOrder(order: Order): Order;
op cancelOrder(id: string): void;
op shipOrder(id: string): Order;

op listInvoices(): InvoiceList;
op getInvoice(id: string): Invoice;
op payInvoice(id: string, amount: float64): Invoice;
op voidInvoice(id: string): void;

op tagWidget(id: string, tag: Tag): Widget;
op untagWidget(id: string, name: string): Widget;
op ping(): string;
op version(): string;
