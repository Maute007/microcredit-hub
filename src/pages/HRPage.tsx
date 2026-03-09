import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mockEmployees, formatCurrency, formatDate, Employee } from "@/data/mockData";
import { Plus, Users, DollarSign, UserCheck, UserX } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nome" },
  { key: "role", label: "Cargo" },
  { key: "salary", label: "Salário", render: (e: Employee) => formatCurrency(e.salary) },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status", render: (e: Employee) => <StatusBadge status={e.status} /> },
  { key: "hireDate", label: "Admissão", render: (e: Employee) => formatDate(e.hireDate) },
];

const active = mockEmployees.filter(e => e.status === "ativo");
const totalSalary = active.reduce((s, e) => s + e.salary, 0);

export default function HRPage() {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader
        title="Recursos Humanos"
        description="Gestão de funcionários e folha de pagamento"
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome completo</Label><Input placeholder="Nome" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cargo</Label><Input placeholder="Cargo" /></div>
                  <div><Label>Salário (MZN)</Label><Input type="number" placeholder="Salário" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input placeholder="Telefone" /></div>
                  <div><Label>Email</Label><Input type="email" placeholder="Email" /></div>
                </div>
                <Button className="w-full" onClick={() => setShowNew(false)}>Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Funcionários" value={String(mockEmployees.length)} icon={Users} />
        <StatCard title="Ativos" value={String(active.length)} icon={UserCheck} variant="success" />
        <StatCard title="Inativos" value={String(mockEmployees.length - active.length)} icon={UserX} variant="warning" />
        <StatCard title="Folha Salarial" value={formatCurrency(totalSalary)} icon={DollarSign} variant="primary" />
      </div>

      <DataTable data={mockEmployees} columns={columns} searchKeys={["name", "role", "email"]} />
    </div>
  );
}
