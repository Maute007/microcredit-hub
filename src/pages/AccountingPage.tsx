import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { mockTransactions, formatCurrency, formatDate, Transaction } from "@/data/mockData";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const entries = mockTransactions.filter(t => t.type === "entrada");
const exits = mockTransactions.filter(t => t.type === "saida");
const totalEntries = entries.reduce((s, t) => s + t.amount, 0);
const totalExits = exits.reduce((s, t) => s + t.amount, 0);

const columns = [
  { key: "id", label: "ID" },
  {
    key: "type", label: "Tipo", render: (t: Transaction) => (
      <div className="flex items-center gap-1.5">
        {t.type === "entrada"
          ? <ArrowUpRight className="h-4 w-4 text-success" />
          : <ArrowDownRight className="h-4 w-4 text-destructive" />}
        <span className="capitalize">{t.type}</span>
      </div>
    ),
  },
  { key: "category", label: "Categoria" },
  { key: "description", label: "Descrição" },
  {
    key: "amount", label: "Valor", render: (t: Transaction) => (
      <span className={`font-medium ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
        {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
      </span>
    ),
  },
  { key: "date", label: "Data", render: (t: Transaction) => formatDate(t.date) },
];

const categoryData = Object.entries(
  mockTransactions.reduce<Record<string, { entrada: number; saida: number }>>((acc, t) => {
    const cat = t.category;
    if (!acc[cat]) acc[cat] = { entrada: 0, saida: 0 };
    acc[cat][t.type] += t.amount;
    return acc;
  }, {})
).map(([name, vals]) => ({ name: name.length > 12 ? name.slice(0, 12) + "…" : name, ...vals }));

export default function AccountingPage() {
  return (
    <div>
      <PageHeader title="Contabilidade" description="Controle financeiro e fluxo de caixa" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Entradas" value={formatCurrency(totalEntries)} icon={TrendingUp} variant="success" />
        <StatCard title="Total Saídas" value={formatCurrency(totalExits)} icon={TrendingDown} variant="destructive" />
        <StatCard title="Saldo" value={formatCurrency(totalEntries - totalExits)} icon={Wallet} variant={totalEntries - totalExits >= 0 ? "primary" : "destructive"} />
      </div>

      <div className="bg-card rounded-lg border p-5 mb-6">
        <h3 className="font-semibold mb-4">Por Categoria</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={categoryData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="entrada" fill="hsl(152,60%,42%)" radius={[0, 4, 4, 0]} name="Entrada" />
            <Bar dataKey="saida" fill="hsl(0,72%,51%)" radius={[0, 4, 4, 0]} name="Saída" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable data={mockTransactions} columns={columns} searchKeys={["category", "description"]} />
    </div>
  );
}
