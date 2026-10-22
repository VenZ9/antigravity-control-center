import React, { useEffect, useState } from 'react';
import { 
  Coins, TrendingUp, Layers, Cpu, Zap, BarChart2, 
  ArrowUpRight, Sparkles 
} from 'lucide-react';
import { TokenAnalytics } from '../types';
import { API } from '../api/client';

export const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await API.getAnalytics();
      setAnalytics(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const grand = analytics?.grandTotal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Disclaimer Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(18, 21, 32, 1) 100%)',
        borderColor: 'rgba(139, 92, 246, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Coins size={18} style={{ color: 'var(--accent-violet)' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
            Token Accounting & Utilization
          </h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {analytics?.disclaimer || 'Aggregated from local turn events across all discovered Antigravity transcripts.'}
        </p>
      </div>

      {/* Grand Totals Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px'
      }}>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Coins size={12} style={{ color: 'var(--accent-violet)' }} />
            Total Tokens
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-violet)', marginTop: '4px' }}>
            {grand ? grand.total_tokens.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Input + Output
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpRight size={12} style={{ color: '#38BDF8' }} />
            Input Tokens
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
            {grand ? grand.input_tokens.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Sent to Model
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={12} style={{ color: 'var(--accent-violet)' }} />
            Output Tokens
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
            {grand ? grand.output_tokens.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Model Generated
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={12} style={{ color: 'var(--success)' }} />
            Cache Hits
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
            {grand ? grand.cache_read_tokens.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Cached Read Tokens
          </div>
        </div>
      </div>

      {/* Daily Usage History */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <TrendingUp size={16} style={{ color: 'var(--accent-violet)' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            Daily Recorded Activity
          </h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
            {[1, 2, 3].map(n => (
              <div key={n} className="skeleton" style={{ height: '32px', width: '100%' }} />
            ))}
          </div>
        ) : (!analytics?.dailyUsage || analytics.dailyUsage.length === 0) ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No daily historical activity recorded.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {analytics.dailyUsage.map(d => {
              const maxTokens = Math.max(...analytics.dailyUsage.map(x => x.total_tokens || 1));
              const pct = Math.min(100, Math.round((d.total_tokens / maxTokens) * 100));

              return (
                <div key={d.date} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.date}</span>
                    <span style={{ color: 'var(--accent-violet)', fontFamily: 'monospace' }}>
                      {d.total_tokens.toLocaleString()} tokens
                    </span>
                  </div>

                  {/* Visual Bar */}
                  <div style={{
                    width: '100%', height: '8px', background: 'var(--bg-elevated)',
                    borderRadius: '4px', overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: 'linear-gradient(90deg, #8B5CF6, #10B981)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversation Token Consumption Ranking */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <BarChart2 size={16} style={{ color: 'var(--accent-violet)' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            Highest Token Consuming Conversations
          </h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
            {[1, 2, 3].map(n => (
              <div key={n} className="skeleton" style={{ height: '48px', width: '100%' }} />
            ))}
          </div>
        ) : (!analytics?.conversationRankings || analytics.conversationRankings.length === 0) ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No conversations with token records found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
            {analytics.conversationRankings.map((c, i) => (
              <div
                key={c.conversationId}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', width: '20px' }}>
                    #{i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {c.stepCount} steps • ID: {c.conversationId.substring(0, 8)}...
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-violet)', fontFamily: 'monospace' }}>
                    {c.total_tokens.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {c.input_tokens.toLocaleString()} in / {c.output_tokens.toLocaleString()} out
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
