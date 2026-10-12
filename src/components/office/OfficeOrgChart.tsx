'use client';

import { OrgChartCard } from '@/components/office/OrgChartCard';
import type { OfficeOrgNode } from '@/lib/vina/officeOrg';

export interface OfficeOrgChartProps {
  root: OfficeOrgNode;
}

function OrgBranch({ node }: { node: OfficeOrgNode }) {
  const hasChildren = node.children.length > 0;

  return (
    <li className="org-branch">
      <div className="org-branch-node">
        <OrgChartCard department={node.department} person={node.person} />
      </div>
      {hasChildren ? (
        <ul className="org-branch-children" aria-label="하위 조직">
          {node.children.map((child) => (
            <OrgBranch
              key={child.person?.id ?? `${child.department}-empty`}
              node={child}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OfficeOrgChart({ root }: OfficeOrgChartProps) {
  const hasDepartments = root.children.length > 0;

  return (
    <div className="org-chart" role="tree" aria-label="사무직 조직도">
      <div className="org-chart-root">
        <OrgChartCard
          department={root.department}
          person={root.person}
          placeholderTitle="법인장"
        />
      </div>

      {hasDepartments ? (
        <>
          <div className="org-chart-spine" aria-hidden />
          <ul className="org-chart-level" aria-label="부서">
            {root.children.map((child) => (
              <OrgBranch
                key={child.person?.id ?? child.department}
                node={child}
              />
            ))}
          </ul>
        </>
      ) : !root.person ? (
        <p className="org-chart-empty text-muted">
          부서가 지정된 사무직 인원이 없습니다. 부서 열이 포함된 Excel을 다시
          업로드해 주세요.
        </p>
      ) : null}
    </div>
  );
}
