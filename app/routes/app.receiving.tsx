import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  EmptyState,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { LocalInventoryNotice } from "../components/LocalInventoryNotice";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const candidatePOs = await prisma.purchaseOrder.findMany({
    where: { shop: session.shop, status: { in: ["open", "in_transit", "partially_received"] } },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      lineItems: {
        select: {
          qtyOrdered: true,
          qtyReceived: true,
          qtyRejected: true,
          qtyBackordered: true,
        },
      },
    },
  });

  const pos = candidatePOs.filter((po) =>
    po.lineItems.some((line) => line.qtyOrdered - line.qtyReceived - line.qtyRejected > 0),
  );

  return { pos, candidateCount: candidatePOs.length };
};

type ReceivingStatus = "open" | "partially_received" | "in_transit";

const statusBadge: Record<ReceivingStatus, { tone: "info" | "warning"; label: string }> = {
  open: { tone: "info", label: "Open" },
  partially_received: { tone: "warning", label: "Partial" },
  in_transit: { tone: "warning", label: "In Transit" },
};

export default function Receiving() {
  const { pos, candidateCount } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = pos.map((po, index) => {
    const qtyOrdered = po.lineItems.reduce((sum, line) => sum + line.qtyOrdered, 0);
    const qtyReceived = po.lineItems.reduce((sum, line) => sum + line.qtyReceived, 0);
    const qtyRejected = po.lineItems.reduce((sum, line) => sum + line.qtyRejected, 0);
    const qtyBackordered = po.lineItems.reduce((sum, line) => sum + line.qtyBackordered, 0);
    const qtyPending = Math.max(0, qtyOrdered - qtyReceived - qtyRejected);
    const status = po.status as ReceivingStatus;

    return (
      <IndexTable.Row
        id={po.id}
        key={po.id}
        selected={false}
        position={index}
        onClick={() => navigate(`/app/purchase-orders/${po.id}/receiving`)}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {po.poNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{po.supplier.name}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={statusBadge[status].tone}>{statusBadge[status].label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{qtyOrdered}</IndexTable.Cell>
        <IndexTable.Cell>{qtyReceived}</IndexTable.Cell>
        <IndexTable.Cell>{qtyRejected}</IndexTable.Cell>
        <IndexTable.Cell>{qtyBackordered}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone={qtyPending > 0 ? "caution" : undefined}>
            {qtyPending}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{new Date(po.createdAt).toLocaleDateString()}</IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            size="slim"
            onClick={() => navigate(`/app/purchase-orders/${po.id}/receiving`)}
          >
            Receive
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const emptyStateMarkup = (
    <EmptyState
      heading="No items pending receipt"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">
          {candidateCount > 0
            ? `${candidateCount} open, in-transit, or partially received PO${candidateCount === 1 ? "" : "s"} were found, but all quantities are fully received or rejected.`
            : "No open, in-transit, or partially received purchase orders were found."}
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          POs appear here only when at least one line has outstanding quantity:
          ordered minus received minus rejected is greater than zero.
        </Text>
      </BlockStack>
    </EmptyState>
  );

  return (
    <Page fullWidth>
      <TitleBar title="Receiving" />
      <BlockStack gap="400">
        <LocalInventoryNotice />
        <Card>
          <BlockStack gap="100">
            <Text as="h1" variant="headingLg">Receiving Queue</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {pos.length > 0
                ? `${pos.length} purchase order${pos.length === 1 ? "" : "s"} ready to receive. Click a row or use Receive to open the receiving screen.`
                : "No purchase orders currently need receiving."}
            </Text>
          </BlockStack>
        </Card>
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "receipt", plural: "receipts" }}
          itemCount={pos.length}
          selectable={false}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "PO #" },
            { title: "Supplier" },
            { title: "Status" },
            { title: "Ordered" },
            { title: "Received" },
            { title: "Rejected" },
            { title: "Backordered" },
            { title: "Pending" },
            { title: "Created" },
            { title: "Action" },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
      </BlockStack>
    </Page>
  );
}
