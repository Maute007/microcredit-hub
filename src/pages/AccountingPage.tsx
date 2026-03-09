import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockTransactions, mockEmployees, formatCurrency, formatDate, Transaction } from "@/data/mockData";
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

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
  { key: "responsible", label: "Responsável" },
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
).map(([name, vals]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, ...vals }));

const dailyFlow = [
  { day: "01 Mar", entrada: 14392, saida: 38500 },
  { day: "03 Mar", entrada: 0, saida: 3500 },
  { day: "04 Mar", entrada: 0, saida: 12000 },
  { day: "05 Mar", entrada: 3422, saida: 278000 },
  { day: "07 Mar", entrada: 0, saida: 20000 },
  { day: "09 Mar", entrada: 9808, saida: 0 },
];

export default function AccountingPage() {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader
        title="Contabilidade"
        description="Controle financeiro e registo de operações"
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Transação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Transação</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (MT)</Label><Input type="number" placeholder="Valor" /></div>
                  <div><Label>Data</Label><Input type="date" defaultValue="2025-03-09" /></div>
                </div>
                <div><Label>Categoria</Label><Input placeholder="Ex: Pagamento Empréstimo, Salários..." /></div>
                <div><Label>Descrição</Label><Input placeholder="Descrição da transação" /></div>
                <div>
                  <Label>Responsável</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {mockEmployees.filter(e => e.status === "ativo").map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setShowNew(false)}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Entradas" value={formatCurrency(totalEntries)} icon={TrendingUp} variant="success" />
        <StatCard title="Total Saídas" value={formatCurrency(totalExits)} icon={TrendingDown} variant="destructive" />
        <StatCard title="Saldo Geral" value={formatCurrency(totalEntries - totalExits)} icon={Wallet} variant={totalEntries - totalExits >= 0 ? "primary" : "destructive"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Fluxo de Caixa Diário (Março)</h3>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={dailyFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="entrada" stroke="hsl(152,60%,42%)" fill="hsl(152,60%,42%)" fillOpacity={0.1} name="Entradas" />
              <Area type="monotone" dataKey="saida" stroke="hsl(0,72%,51%)" fill="hsl(0,72%,51%)" fillOpacity={0.1} name="Saídas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Por Categoria</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="entrada" fill="hsl(152,60%,42%)" radius={[0, 4, 4, 0]} name="Entrada" />
              <Bar dataKey="saida" fill="hsl(0,72%,51%)" radius={[0, 4, 4, 0]} name="Saída" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable data={mockTransactions} columns={columns} searchKeys={["category", "description", "responsible"]} />
    </div>
  );
}
