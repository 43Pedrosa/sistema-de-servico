import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Eye, Edit, Trash2, Smartphone, Package, RefreshCw, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { ServiceOrder } from '../types';
import {
  fetchAllOrders,
  deleteOrder,
  getAdminUser,
} from '../lib/storage';
import { ORDER_STAGES } from '../lib/constants';
import { StatusBadge } from '../components/StatusBadge';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const getOrderStage = (order: ServiceOrder) => order.budget_status === 'recusado'
  ? 'budget'
  : ORDER_STAGES.find(stage => stage.statuses.some(status => status === order.status))?.key ?? 'customer';
const shouldShowBudgetStatus = (order: ServiceOrder) =>
  ['aguardando_aprovacao', 'recusado', 'em_revisao'].includes(order.budget_status) ||
  (order.budget_status === 'aprovado' && order.status === 'orcamento_aprovado');

export const AdminDashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc'>('date_desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const adminUser = getAdminUser();
  const isAuthenticated = Boolean(adminUser);
  const canDeleteOrders = adminUser?.role === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setOrders(await fetchAllOrders());
    } catch (error) {
      console.error(error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/admin/login'); return; }
    void loadData();
  }, [isAuthenticated, loadData, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = window.setInterval(() => { void loadData(); }, 30_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, loadData]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteOrder(id);
      setDeleteConfirmId(null);
      await loadData();
    } catch (error) {
      console.error(error);
      setLoadError(true);
    } finally {
      setDeleting(false);
    }
  };

  const statusCounts = useMemo(() => orders.reduce((counts, order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
    if (order.status !== 'entregue' && !order.is_cancelled) counts.open += 1;
    return counts;
  }, { open: 0 } as Record<string, number>), [orders]);

  const stageCounts = useMemo(() => orders.reduce((counts, order) => {
    const stage = getOrderStage(order);
    counts[stage] += 1;
    return counts;
  }, { customer: 0, device: 0, budget: 0, finalization: 0 }), [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return orders.filter(order => {
      const searchable = [order.os_number, order.customer_name, order.device_model, order.device_brand].join(' ').toLocaleLowerCase('pt-BR');
      return (!query || searchable.includes(query)) && (statusFilter === 'all' || getOrderStage(order) === statusFilter);
    }).sort((a, b) => {
      if (sortBy === 'amount_desc') return b.total_amount - a.total_amount;
      const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortBy === 'date_desc' ? -delta : delta;
    });
  }, [orders, searchTerm, statusFilter, sortBy]);

  return (
    <div className="bench-dashboard">
      <header className="bench-heading">
        <h1>Ordens de serviço</h1>
      </header>

      <section className="bench-workflow" aria-label="Ordens por etapa do reparo">
        <div className="bench-workflow-title">
          <div><span>Fila da bancada</span><strong>{statusCounts.open || 0}</strong></div>
          <span className="bench-workflow-caption">ordens em andamento</span>
        </div>
        <div className="bench-stage-track">
          {ORDER_STAGES.map(stage => (
            <button
              type="button"
              key={stage.key}
              className={`bench-stage bench-stage-${stage.key} ${statusFilter === stage.key ? 'is-selected' : ''}`}
              onClick={() => setStatusFilter(statusFilter === stage.key ? 'all' : stage.key)}
              aria-pressed={statusFilter === stage.key}
            >
              <span className="bench-stage-count">{stageCounts[stage.key]}</span>
              <span className="bench-stage-label">{stage.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bench-queue" aria-label="Lista de ordens de serviço">
        <div className="bench-queue-toolbar">
          <div className="bench-queue-title">
            <h2>Fila de atendimento</h2>
            {!loading && <span>{filteredOrders.length} {filteredOrders.length === 1 ? 'ordem' : 'ordens'}</span>}
          </div>
          <div className="bench-controls">
            <label className="bench-search">
              <Search size={17} aria-hidden="true" />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar cliente, aparelho ou OS" aria-label="Buscar ordens" />
            </label>
            <label className="bench-select-wrap" aria-label="Ordenar ordens">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}>
                <option value="date_desc">Mais recentes</option>
                <option value="date_asc">Mais antigas</option>
                <option value="amount_desc">Maior valor</option>
              </select>
            </label>
            <button type="button" className="bench-refresh" onClick={() => void loadData()} disabled={loading} aria-label="Atualizar ordens" title="Atualizar ordens"><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /></button>
          </div>
        </div>
        {statusFilter !== 'all' && (
          <div className="bench-active-filter">Etapa: {ORDER_STAGES.find(stage => stage.key === statusFilter)?.label}<button type="button" onClick={() => setStatusFilter('all')}>Limpar filtro</button></div>
        )}

        {loading ? (
          <div className="bench-state" role="status"><span className="bench-loader" /><strong>Carregando a fila</strong><span>Buscando as ordens da loja.</span></div>
        ) : loadError ? (
          <div className="bench-state" role="alert"><AlertTriangle size={25} /><strong>Não foi possível carregar as ordens</strong><span>Confira a conexão e tente novamente.</span><button type="button" onClick={() => void loadData()}>Tentar novamente</button></div>
        ) : filteredOrders.length === 0 ? (
          <div className="bench-state"><Package size={28} /><strong>{orders.length ? 'Nenhuma ordem corresponde à busca' : 'A bancada está livre'}</strong><span>{orders.length ? 'Tente outro nome, aparelho ou etapa.' : 'Use “Nova OS” na barra inferior para cadastrar uma ordem.'}</span></div>
        ) : (
          <>
            <div className="bench-table-scroll">
              <table className="bench-table">
                <thead><tr><th>Ordem</th><th>Cliente</th><th>Aparelho</th><th>Etapa atual</th><th>Valor</th><th>Previsão</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{filteredOrders.map(order => (
                  <tr key={order.id}>
                    <td><div className="bench-order-number">#{order.os_number}</div><div className="bench-order-date">{dateFormatter.format(new Date(order.created_at))}</div></td>
                    <td><div className="bench-customer">{order.customer_name || 'Não informado'}</div><div className="bench-secondary">{order.customer_phone}</div></td>
                    <td><div className="bench-device"><Smartphone size={15} />{order.device_brand} {order.device_model}</div><div className="bench-secondary">{order.photos?.length || 0} {order.photos?.length === 1 ? 'foto' : 'fotos'}{order.device_color ? ` · ${order.device_color}` : ''}</div></td>
                    <td>
                      <div className="flex flex-col items-start gap-1.5">
                        {shouldShowBudgetStatus(order)
                          ? <StatusBadge budgetStatus={order.budget_status} size="sm" />
                          : <StatusBadge status={order.status} size="sm" />}
                      </div>
                    </td>
                    <td className="bench-price">{currencyFormatter.format(order.total_amount || 0)}</td>
                    <td className="bench-due">{order.estimated_completion || '—'}</td>
                    <td><div className="bench-actions">
                      <Link to={`/consultar/${order.os_number}`} target="_blank" rel="noopener noreferrer" className="bench-action" aria-label={`Ver ordem ${order.os_number} como cliente`} title="Ver consulta do cliente"><Eye size={16} /></Link>
                      <Link to={`/admin/os/edit/${order.id}`} className="bench-action" aria-label={`Editar ordem ${order.os_number}`} title="Editar ordem"><Edit size={16} /></Link>
                      {canDeleteOrders && (deleteConfirmId === order.id ? <div className="bench-confirm"><span>Excluir ordem?</span><button type="button" onClick={() => void handleDelete(order.id)} disabled={deleting}>Sim</button><button type="button" onClick={() => setDeleteConfirmId(null)}>Não</button></div> : <button type="button" className="bench-action is-danger" aria-label={`Excluir ordem ${order.os_number}`} title="Excluir ordem" onClick={() => setDeleteConfirmId(order.id)}><Trash2 size={16} /></button>)}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="bench-mobile-list">{filteredOrders.map(order => (
              <article className="bench-mobile-order" key={order.id}>
                <div className="bench-mobile-order-top"><div><span className="bench-order-number">#{order.os_number}</span><span className="bench-order-date">{dateFormatter.format(new Date(order.created_at))}</span></div><div className="flex flex-col items-end gap-1.5">{shouldShowBudgetStatus(order) ? <StatusBadge budgetStatus={order.budget_status} size="sm" /> : <StatusBadge status={order.status} size="sm" />}</div></div>
                <div className="bench-customer">{order.customer_name || 'Não informado'}</div>
                <div className="bench-device"><Smartphone size={15} />{order.device_brand} {order.device_model}</div>
                <div className="bench-mobile-meta"><span>{currencyFormatter.format(order.total_amount || 0)}</span><span>Previsão {order.estimated_completion || '—'}</span></div>
                <div className="bench-mobile-actions"><Link to={`/consultar/${order.os_number}`} target="_blank" rel="noopener noreferrer"><Eye size={15} /> Consulta</Link><Link to={`/admin/os/edit/${order.id}`}><Edit size={15} /> Editar</Link>{canDeleteOrders && <button type="button" onClick={() => setDeleteConfirmId(order.id)}><Trash2 size={15} /> Excluir</button>}</div>
                {canDeleteOrders && deleteConfirmId === order.id && <div className="bench-confirm bench-confirm-mobile"><span>Excluir ordem?</span><button type="button" onClick={() => void handleDelete(order.id)} disabled={deleting}>Sim</button><button type="button" onClick={() => setDeleteConfirmId(null)}>Não</button></div>}
              </article>
            ))}</div>
          </>
        )}
      </section>
    </div>
  );
};
