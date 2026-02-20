import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
  ShadingType,
  convertInchesToTwip,
} from 'docx';

interface AccountPlanExportData {
  planName: string;
  planDate: string;
  status: string;
  accountSnapshot: Record<string, any>;
  renewalOppsSnapshot: Record<string, any>[];
  expansionOppsSnapshot: Record<string, any>[];
  contactsSnapshot: Record<string, any>[];
  executiveSummary: string;
  retentionStrategy: string;
  growthStrategy: string;
  keyInitiatives: string;
  risksAndMitigations: string;
  nextSteps: string;
  additionalNotes: string;
  aiAnalysis?: Record<string, any> | null;
  leadershipAsks?: Record<string, any>[] | null;
  dayPlans?: Record<string, any> | null;
  actionItems?: Record<string, any>[] | null;
}

function formatCurrency(amount: number | undefined | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function createHeaderCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, color: 'FFFFFF' })],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: '6B21A8' },
    width: { size: 0, type: WidthType.AUTO },
  });
}

function createCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20 })],
      }),
    ],
    width: { size: 0, type: WidthType.AUTO },
  });
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 300, after: 100 },
  });
}

function bodyText(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text || '(No content)', size: 22 })],
    spacing: { after: 100 },
  });
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value || '—', size: 22 }),
    ],
    spacing: { after: 60 },
  });
}

function spacer(): Paragraph {
  return new Paragraph({ text: '', spacing: { after: 100 } });
}

export async function generateWordDocument(data: AccountPlanExportData): Promise<Buffer> {
  const account = data.accountSnapshot || {};

  const children: (Paragraph | Table)[] = [];

  // ── Title Page ──
  children.push(
    new Paragraph({
      text: data.planName,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: account.Name || 'Account', size: 32, color: '6B21A8' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Plan Date: ${formatDate(data.planDate)}  |  Status: ${data.status}`, size: 22, color: '666666' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  // ── 1. Title / Account Info ──
  children.push(heading('1. Account Information'));

  const infoTable = new Table({
    rows: [
      new TableRow({ children: [createHeaderCell('Field'), createHeaderCell('Value')] }),
      new TableRow({ children: [createCell('Account Name'), createCell(account.Name || '—')] }),
      new TableRow({ children: [createCell('Industry'), createCell(account.Industry || '—')] }),
      new TableRow({ children: [createCell('Parent Account'), createCell(account.Parent?.Name || account.Clay_Parent_Account__c || '—')] }),
      new TableRow({ children: [createCell('Account Owner'), createCell(account.Owner?.Name || '—')] }),
      new TableRow({ children: [createCell('Customer Stage'), createCell(account.Customer_Stage__c || '—')] }),
      new TableRow({ children: [createCell('Location'), createCell([account.BillingCity, account.BillingState, account.BillingCountry].filter(Boolean).join(', ') || '—')] }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  children.push(infoTable, spacer());

  // ── 2. Account Overview ──
  children.push(heading('2. Account Overview'));
  children.push(
    labelValue('Total ARR', formatCurrency(account.Total_ARR__c)),
    labelValue('Contracted Users', (account.Contract_Total_License_Seats__c || account.of_Axonify_Users__c || '—').toString()),
    labelValue('Success Score', (account.Customer_Success_Score__c || account.Current_Gainsight_Score__c || '—').toString()),
    labelValue('Risk Level', account.Risk__c || '—'),
    labelValue('Contract End Date', formatDate(account.Agreement_Expiry_Date__c)),
    labelValue('Max Utilization', account.License_Utilization_Max__c != null ? `${Math.round(account.License_Utilization_Max__c)}%` : '—'),
    spacer(),
  );

  // ── 3. Renewal Opportunities ──
  children.push(heading('3. Renewal Opportunities'));
  if (data.renewalOppsSnapshot.length === 0) {
    children.push(bodyText('No open renewal opportunities.'));
  } else {
    const renewalRows = [
      new TableRow({
        children: [
          createHeaderCell('Opportunity'),
          createHeaderCell('Amount'),
          createHeaderCell('Stage'),
          createHeaderCell('Close Date'),
        ],
      }),
      ...data.renewalOppsSnapshot.map(opp =>
        new TableRow({
          children: [
            createCell(opp.Name || '—'),
            createCell(formatCurrency(opp.Amount || opp.ARR__c)),
            createCell(opp.StageName || '—'),
            createCell(formatDate(opp.CloseDate)),
          ],
        })
      ),
    ];
    children.push(
      new Table({ rows: renewalRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      spacer(),
    );

    // MEDDPICC details for first renewal
    const firstRenewal = data.renewalOppsSnapshot[0];
    const meddpiccFields = [
      { label: 'Metrics', value: firstRenewal.COM_Metrics__c },
      { label: 'Economic Buyer', value: firstRenewal.MEDDPICCR_Economic_Buyer__c || firstRenewal.Economic_Buyer_Name__c },
      { label: 'Decision Criteria', value: firstRenewal.MEDDPICCR_Decision_Criteria__c },
      { label: 'Decision Process', value: firstRenewal.MEDDPICCR_Decision_Process__c },
      { label: 'Champion', value: firstRenewal.MEDDPICCR_Champion__c },
      { label: 'Competition', value: firstRenewal.MEDDPICCR_Competition__c },
      { label: 'Risks', value: firstRenewal.MEDDPICCR_Risks__c },
    ].filter(f => f.value);

    if (meddpiccFields.length > 0) {
      children.push(new Paragraph({ text: 'MEDDPICC Details', heading: HeadingLevel.HEADING_3 }));
      meddpiccFields.forEach(f => children.push(labelValue(f.label, f.value)));
      children.push(spacer());
    }
  }

  // ── 4. Expansion Opportunities ──
  children.push(heading('4. Expansion Opportunities'));
  if (data.expansionOppsSnapshot.length === 0) {
    children.push(bodyText('No open expansion opportunities.'));
  } else {
    const expRows = [
      new TableRow({
        children: [
          createHeaderCell('Opportunity'),
          createHeaderCell('Type'),
          createHeaderCell('Amount'),
          createHeaderCell('Stage'),
          createHeaderCell('Close Date'),
        ],
      }),
      ...data.expansionOppsSnapshot.map(opp =>
        new TableRow({
          children: [
            createCell(opp.Name || '—'),
            createCell(opp.Type || 'Expansion'),
            createCell(formatCurrency(opp.Amount || opp.ARR__c)),
            createCell(opp.StageName || '—'),
            createCell(formatDate(opp.CloseDate)),
          ],
        })
      ),
    ];
    children.push(
      new Table({ rows: expRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      spacer(),
    );
  }

  // ── 5. Key Stakeholders ──
  children.push(heading('5. Key Stakeholders'));
  if (data.contactsSnapshot.length === 0) {
    children.push(bodyText('No contacts found.'));
  } else {
    const contactRows = [
      new TableRow({
        children: [
          createHeaderCell('Name'),
          createHeaderCell('Title'),
          createHeaderCell('Email'),
          createHeaderCell('Phone'),
        ],
      }),
      ...data.contactsSnapshot.slice(0, 20).map(contact =>
        new TableRow({
          children: [
            createCell(contact.Name || `${contact.FirstName || ''} ${contact.LastName || ''}`.trim() || '—'),
            createCell(contact.Title || '—'),
            createCell(contact.Email || '—'),
            createCell(contact.Phone || '—'),
          ],
        })
      ),
    ];
    children.push(
      new Table({ rows: contactRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      spacer(),
    );
  }

  // ── 6. Health & Risk ──
  children.push(heading('6. Health & Risk'));
  children.push(
    labelValue('Risk Level', account.Risk__c || '—'),
    labelValue('Success Score', (account.Customer_Success_Score__c || account.Current_Gainsight_Score__c || '—').toString()),
    labelValue('Max Utilization', account.License_Utilization_Max__c != null ? `${Math.round(account.License_Utilization_Max__c)}%` : '—'),
  );
  if (account.Risk_Notes__c) children.push(labelValue('Risk Notes', account.Risk_Notes__c));
  if (account.Overall_Customer_Health_Notes__c) children.push(labelValue('Health Notes', account.Overall_Customer_Health_Notes__c));
  if (account.Support_Notes__c) children.push(labelValue('Support Notes', account.Support_Notes__c));
  children.push(spacer());

  // ── 7. CS Insights ──
  children.push(heading('7. CS Insights'));
  children.push(
    labelValue('Gainsight Score', (account.Current_Gainsight_Score__c || '—').toString()),
    labelValue('Last QBR', formatDate(account.Last_QBR__c)),
    labelValue('Last Exec Check-In', formatDate(account.Last_Exec_Check_In__c)),
  );
  if (account.Strategy_Notes__c) children.push(labelValue('Strategy Notes', account.Strategy_Notes__c));
  if (account.Contract_Notes__c) children.push(labelValue('Contract Notes', account.Contract_Notes__c));
  children.push(spacer());

  // ── 8. Historical Context ──
  children.push(heading('8. Historical Context'));
  children.push(
    labelValue('Account Created', formatDate(account.CreatedDate)),
    labelValue('Launch Date', formatDate(account.Launch_Date__c)),
    labelValue('Contract End', formatDate(account.Agreement_Expiry_Date__c)),
    labelValue('Industry', account.Industry || '—'),
    labelValue('Location', [account.BillingCity, account.BillingState, account.BillingCountry].filter(Boolean).join(', ') || '—'),
    spacer(),
  );

  // ── 9. AI Strategic Analysis ──
  if (data.aiAnalysis) {
    const ai = data.aiAnalysis;
    children.push(heading('9. AI Strategic Analysis'));

    if (ai.generatedAt) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Generated: ${formatDate(ai.generatedAt)}`, size: 18, color: '666666', italics: true })],
        spacing: { after: 100 },
      }));
    }

    const aiFields = [
      { label: 'Renewal Confidence', value: ai.renewalConfidence },
      { label: 'Renewal Strategy', value: ai.renewalStrategy },
      { label: 'Gong Sentiment', value: ai.gongSentiment },
      { label: 'Pipeline Gap', value: ai.pipelineGap },
      { label: 'Next Action', value: ai.nextAction },
    ];
    aiFields.forEach(f => { if (f.value) children.push(labelValue(f.label, f.value)); });
    children.push(spacer());

    // Why Stay
    children.push(new Paragraph({ text: 'Why Stay — Stakeholder Perspectives', heading: HeadingLevel.HEADING_3 }));
    const whyStayFields = [
      { label: 'Economic Buyer', value: ai.whyStayEconomicBuyer },
      { label: 'Admin / Power Users', value: ai.whyStayAdmin },
      { label: 'Procurement', value: ai.whyStayProcurement },
      { label: 'End Users', value: ai.whyStayUsers },
      { label: 'Retention Risks', value: ai.whyStayRisks },
    ];
    whyStayFields.forEach(f => { if (f.value) children.push(labelValue(f.label, f.value)); });
    children.push(spacer());

    // Intelligence
    children.push(new Paragraph({ text: 'Intelligence & Context', heading: HeadingLevel.HEADING_3 }));
    const intelFields = [
      { label: 'Competitive Mentions', value: ai.competitiveMentions },
      { label: 'Whitespace Opportunities', value: ai.whitespaceOpportunities },
      { label: 'Whitespace Strategy', value: ai.whitespaceStrategy },
      { label: 'Stakeholder Intelligence', value: ai.stakeholderIntelligence },
      { label: 'Key Decision Makers', value: ai.keyDecisionMakers },
      { label: 'Tech Stack', value: ai.techStack },
      { label: 'Key Themes', value: ai.keyThemes },
      { label: 'Account History', value: ai.accountHistory },
      { label: 'Resource Needs', value: ai.resourceNeeds },
    ];
    intelFields.forEach(f => { if (f.value) children.push(labelValue(f.label, f.value)); });
    children.push(spacer());
  }

  // ── 10. Leadership Asks ──
  if (data.leadershipAsks && data.leadershipAsks.length > 0) {
    children.push(heading('10. Leadership Asks'));

    const asksRows = [
      new TableRow({
        children: [
          createHeaderCell('Initiative'),
          createHeaderCell('Urgency'),
          createHeaderCell('Action'),
          createHeaderCell('Owner'),
          createHeaderCell('Quarter'),
        ],
      }),
      ...data.leadershipAsks.map((ask: any) =>
        new TableRow({
          children: [
            createCell(ask.initiative || '—'),
            createCell(ask.urgency || '—'),
            createCell(ask.action || '—'),
            createCell(ask.owner || '—'),
            createCell(ask.quarter || '—'),
          ],
        })
      ),
    ];
    children.push(
      new Table({ rows: asksRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      spacer(),
    );
  }

  // ── 11. 30/60/90 Day Plan ──
  if (data.dayPlans) {
    children.push(heading('11. 30/60/90 Day Plan'));

    const planSections = [
      { label: 'First 30 Days', value: data.dayPlans.thirtyDay },
      { label: 'Days 31-60', value: data.dayPlans.sixtyDay },
      { label: 'Days 61-90', value: data.dayPlans.ninetyDay },
    ];

    planSections.forEach(({ label, value }) => {
      children.push(
        new Paragraph({ text: label, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
      );
      if (value) {
        value.split('\n').forEach((line: string) => children.push(bodyText(line)));
      } else {
        children.push(bodyText('(No content)'));
      }
    });
    children.push(spacer());
  }

  // ── 12. Action Items ──
  if (data.actionItems && data.actionItems.length > 0) {
    children.push(heading('12. Action Items'));

    const statusLabel: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
    const actionRows = [
      new TableRow({
        children: [
          createHeaderCell('Status'),
          createHeaderCell('Description'),
          createHeaderCell('Owner'),
          createHeaderCell('Due Date'),
        ],
      }),
      ...data.actionItems.map((item: any) =>
        new TableRow({
          children: [
            createCell(statusLabel[item.status] || item.status || '—'),
            createCell(item.description || '—'),
            createCell(item.owner || '—'),
            createCell(item.dueDate ? formatDate(item.dueDate) : '—'),
          ],
        })
      ),
    ];
    children.push(
      new Table({ rows: actionRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      spacer(),
    );
  }

  // ── 13. Strategy & Plan (User-authored) ──
  children.push(heading('13. Strategy & Plan'));

  const strategyFields = [
    { label: 'Executive Summary', value: data.executiveSummary },
    { label: 'Retention Strategy', value: data.retentionStrategy },
    { label: 'Growth Strategy', value: data.growthStrategy },
    { label: 'Key Initiatives', value: data.keyInitiatives },
    { label: 'Risks & Mitigations', value: data.risksAndMitigations },
    { label: 'Next Steps', value: data.nextSteps },
    { label: 'Additional Notes', value: data.additionalNotes },
  ];

  strategyFields.forEach(({ label, value }) => {
    children.push(
      new Paragraph({ text: label, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
    );
    if (value) {
      value.split('\n').forEach(line => {
        children.push(bodyText(line));
      });
    } else {
      children.push(bodyText('(No content)'));
    }
  });

  // ── Build Document ──
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
