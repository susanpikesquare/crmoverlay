/**
 * Salesforce List View Service
 *
 * Provides access to Salesforce List Views — the saved views that users
 * see in the Salesforce UI. Allows fetching available list views and
 * executing them to get filtered results.
 */

import { Connection } from 'jsforce';

export interface ListView {
  id: string;
  label: string;
  developerName: string;
  describeUrl: string;
  resultsUrl: string;
  soqlCompatible: boolean;
}

export interface ListViewColumn {
  fieldNameOrPath: string;
  label: string;
  type: string;
  sortable: boolean;
}

export interface ListViewResults {
  id: string;
  label: string;
  columns: ListViewColumn[];
  records: any[];
  size: number;
}

/**
 * Get all list views available for a given object type
 */
export async function getListViewsForObject(
  connection: Connection,
  objectType: string
): Promise<ListView[]> {
  try {
    const result: any = await connection.sobject(objectType).listviews();
    const views = result?.listviews || [];

    return views.map((v: any) => ({
      id: v.id,
      label: v.label,
      developerName: v.developerName,
      describeUrl: v.describeUrl,
      resultsUrl: v.resultsUrl,
      soqlCompatible: v.soqlCompatible ?? true,
    }));
  } catch (error: any) {
    console.error(`Error fetching list views for ${objectType}:`, error.message);
    return [];
  }
}

/**
 * Execute a specific list view and return its results
 */
export async function getListViewResults(
  connection: Connection,
  objectType: string,
  listViewId: string
): Promise<ListViewResults | null> {
  try {
    const result: any = await connection.sobject(objectType).listview(listViewId).results();

    const columns: ListViewColumn[] = (result?.columns || []).map((col: any) => ({
      fieldNameOrPath: col.fieldNameOrPath,
      label: col.label,
      type: col.type,
      sortable: col.sortable ?? false,
    }));

    const records = (result?.records || []).map((rec: any) => {
      // List view results have a different structure — normalize to flat objects
      const record: any = {};
      if (rec.columns) {
        for (const col of rec.columns) {
          record[col.fieldNameOrPath] = col.value;
        }
      }
      // Also include direct fields if present
      if (rec.Id) record.Id = rec.Id;
      return record;
    });

    return {
      id: listViewId,
      label: result?.label || '',
      columns,
      records,
      size: result?.size || records.length,
    };
  } catch (error: any) {
    console.error(`Error fetching list view results for ${objectType}/${listViewId}:`, error.message);
    return null;
  }
}
