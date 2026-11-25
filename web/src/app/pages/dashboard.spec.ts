import {expect,it} from 'vitest';
import {summarize} from './dashboard';
import type {Invoice,Entry,Project} from '../api/ledger';

it('totals INR invoices by status and finds work left to bill',()=>{
  const base:Invoice={id:1,number:'INV-2026-0001',client_id:1,issue_date:'2026-01-01',due_date:'2026-01-15',
    tax_rate_bps:0,subtotal_minor:'0',tax_minor:'0',total_minor:'9007199254740993',status:'sent',currency:'INR',paid_on:null,created_at:''};
  const entry:Entry={id:1,project_id:1,minutes:60,description:'Design',billable:true,entry_date:'2026-01-01',invoice_id:null,hourly_rate_override_minor:null};
  const project:Project={id:1,name:'Guide',client_id:1,archived:true,default_hourly_rate_minor:'0'};
  const s=summarize({clients:[],projects:[project],entries:[entry,{...entry,invoice_id:2},{...entry,billable:false}],
    invoices:[base,{...base,total_minor:'10'},{...base,currency:'INR',total_minor:'25'},{...base,status:'draft'},{...base,status:'paid'}]});
  expect(s.invoiceGroups.map(g=>g.count)).toEqual([3,1,1]);
  expect(s.invoiceGroups[0].totalMinor).toBe('9007199254741028');
  expect(s.active).toBe(0);expect(s.unbilled).toBe('1h 0m');expect(s.recorded).toBe('3h 0m');expect(s.work[0].minutes).toBe(60);
});
