
import { useState, useEffect } from 'react';

// Milestone definitions with weights
// Entry Probability: T(0), S(10), D(25), C(50), B(75), A(90), W(100)
// Points earned by completing a milestone's specific items bring you TO the NEXT stage's probability.
// T items sum to 10 (reach S)
// S items sum to 15 (reach D: 10+15=25)
// D items sum to 25 (reach C: 25+25=50)
// C items sum to 25 (reach B: 50+25=75)
// B items sum to 15 (reach A: 75+15=90)
// A items sum to 10 (reach W: 90+10=100)

type MilestoneKey = 'T' | 'S' | 'D' | 'C' | 'B' | 'A' | 'W';

interface MilestoneItem {
    id: string;
    text: string;
    checked: boolean;
    weight: number;
}

interface MilestoneSection {
    key: MilestoneKey;
    label: string; // e.g., "區域 (Zone)"
    baseProb: string; // e.g., "0%" or "10%"
    description: string;
    items: MilestoneItem[];
    rowSpan: number;
}

interface OpportunityScorecardProps {
    opportunityId: string;
    initialChecks?: Record<string, boolean>; // map of itemId -> boolean
    onScoreChange: (score: number, checks: Record<string, boolean>) => void;
}

export function OpportunityScorecard({ opportunityId: _opportunityId, initialChecks = {}, onScoreChange }: OpportunityScorecardProps) {

    // Initial configuration of milestones
    const createMilestones = (): MilestoneSection[] => {
        return [
            {
                key: 'T',
                label: 'T',
                baseProb: '',
                description: '區域',
                items: [
                    { id: 't1', text: '發現區域內的機會', checked: false, weight: 2.5 },
                    { id: 't2', text: '滿足市場標準', checked: false, weight: 2.5 },
                    { id: 't3', text: '發現潛在支持者', checked: false, weight: 2.5 },
                    { id: 't4', text: '建立初步聯繫', checked: false, weight: 2.5 },
                ],
                rowSpan: 4
            },
            {
                key: 'S',
                label: 'S',
                baseProb: '10%',
                description: '合格的潛在客戶',
                items: [
                    { id: 's1', text: '支持者承認痛苦', checked: false, weight: 3 },
                    { id: 's2', text: '支持者有具有價值的購買構想', checked: false, weight: 3 },
                    { id: 's3', text: '支持者同意繼續協商購買', checked: false, weight: 3 },
                    { id: 's4', text: '支持者同意引薦權力支持者', checked: false, weight: 3 },
                    { id: 's5', text: '在支持者信函中就上述事項達成一致', checked: false, weight: 3 },
                ],
                rowSpan: 5
            },
            {
                key: 'D',
                label: 'D',
                baseProb: '25%',
                description: '合格的支持者',
                items: [
                    { id: 'd1', text: '與權力支持者會面', checked: false, weight: 4.16 },
                    { id: 'd2', text: '權力支持者承認痛苦', checked: false, weight: 4.16 },
                    { id: 'd3', text: '權力支持者有具有價值的購買構想', checked: false, weight: 4.16 },
                    { id: 'd4', text: '權力支持者同意繼續協商購買', checked: false, weight: 4.16 },
                    { id: 'd5', text: '提出評估計劃', checked: false, weight: 4.16 },
                    { id: 'd6', text: '就評估計劃達成一致', checked: false, weight: 4.2 }, // Adjusted for rounding
                ],
                rowSpan: 6
            },
            {
                key: 'C',
                label: 'C',
                baseProb: '50%',
                description: '合格的權力支持者',
                items: [
                    { id: 'c1', text: '評估計劃談判', checked: false, weight: 5 },
                    { id: 'c2', text: '提案前評審', checked: false, weight: 5 },
                    { id: 'c3', text: '請求業務', checked: false, weight: 5 },
                    { id: 'c4', text: '商討提案', checked: false, weight: 5 },
                    { id: 'c5', text: '收到口頭支持', checked: false, weight: 5 },
                ],
                rowSpan: 5
            },
            {
                key: 'B',
                label: 'B',
                baseProb: '75%',
                description: '決策定案',
                items: [
                    { id: 'b1', text: '就合約進行談判', checked: false, weight: 15 },
                ],
                rowSpan: 1
            },
            {
                key: 'A',
                label: 'A',
                baseProb: '90%',
                description: '等候結案',
                items: [
                    { id: 'a1', text: '書面簽約', checked: false, weight: 10 },
                ],
                rowSpan: 1
            },
            {
                key: 'W',
                label: 'W',
                baseProb: '100%',
                description: '成交',
                items: [
                    { id: 'w1', text: '更新潛在客戶數據庫', checked: false, weight: 0 },
                ],
                rowSpan: 1
            },
        ];
    };

    const [milestones, setMilestones] = useState<MilestoneSection[]>(createMilestones());
    const [totalScore, setTotalScore] = useState(0);

    // Apply initial checks
    useEffect(() => {
        if (Object.keys(initialChecks).length > 0) {
            setMilestones(prev => {
                // Check if we actually need to update to avoid infinite loop
                const needsUpdate = prev.some(section =>
                    section.items.some(item => {
                        const shouldBeChecked = initialChecks[item.id] || false;
                        return item.checked !== shouldBeChecked;
                    })
                );

                if (!needsUpdate) return prev;

                return prev.map(section => ({
                    ...section,
                    items: section.items.map(item => ({
                        ...item,
                        checked: initialChecks[item.id] || false
                    }))
                }));
            });
        }
    }, [initialChecks]); // Only run when initialChecks deeply changes or on mount

    // Calculate score whenever milestones change
    useEffect(() => {
        let score = 0;
        const currentChecks: Record<string, boolean> = {};

        milestones.forEach(section => {
            section.items.forEach(item => {
                if (item.checked) {
                    score += item.weight;
                }
                currentChecks[item.id] = item.checked;
            });
        });

        // Cap at 100
        score = Math.min(Math.round(score), 100);
        setTotalScore(score);

        // Notify parent
        onScoreChange(score, currentChecks);
    }, [milestones]);

    const toggleItem = (sectionKey: MilestoneKey, itemId: string) => {
        setMilestones(prev =>
            prev.map(section => {
                if (section.key === sectionKey) {
                    return {
                        ...section,
                        items: section.items.map(item =>
                            item.id === itemId ? { ...item, checked: !item.checked } : item
                        )
                    };
                }
                return section;
            })
        );
    };

    return (
        <div className="ooda-scorecard">
            <h3 className="ooda-subsection-title">
                機會評分表 (目前分數: <span style={{ color: '#2563eb' }}>{totalScore}%</span>)
            </h3>

            <table className="ooda-score-table">
                <thead>
                    <tr>
                        <th style={{ width: '60px' }}>里程碑</th>
                        <th style={{ width: '100px' }}>成交機率</th>
                        <th style={{ width: '150px' }}>里程碑描述</th>
                        <th>檢核項目</th>
                    </tr>
                </thead>
                <tbody>
                    {milestones.map((section) => (
                        <tr key={section.key}>
                            <td className="text-center font-bold">{section.label}</td>
                            <td className="text-center">{section.baseProb}</td>
                            <td className="text-center font-medium">{section.description}</td>
                            <td className="checklist-cell">
                                {section.items.map(item => (
                                    <div key={item.id} className="checklist-item" onClick={() => toggleItem(section.key, item.id)}>
                                        <div className={`checkbox-label ${item.checked ? 'checked' : ''}`}>
                                            <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${item.checked ? 'bg-white border-blue-600' : 'bg-white border-gray-300'}`}>
                                                {item.checked && (
                                                    <svg className="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="checkbox-text">{item.text}</span>
                                        </div>
                                    </div>
                                ))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="ooda-scorecard-legend">
                <div className="legend-item"><strong>T (Territory) - 區域/目標名單</strong>：尚未接觸的目標市場</div>
                <div className="legend-item"><strong>S (Suspect) - 潛在客戶</strong>：已初步接觸，確認具備基本資質</div>
                <div className="legend-item"><strong>D (Discovery) - 合格支持者</strong>：由內部支持者 (Sponsor) 協助，進入需求診斷 (Discovery) 階段</div>
                <div className="legend-item"><strong>C (Champion) - 權力支持者</strong>：已接觸具決策權的內部冠軍 (Champion)，方案獲認可</div>
                <div className="legend-item"><strong>B (Best Few) - 決策定案</strong>：我方已入選最終名單 (Best Few)，等待客戶做購買決策</div>
                <div className="legend-item"><strong>A (Agreement) - 等候結案</strong>：已獲選，等待合約簽核 (Agreement) 或行政流程</div>
                <div className="legend-item"><strong>W (Win) - 正式成交</strong>：贏得訂單</div>
            </div>

            <style>{`
                .ooda-scorecard {
                    margin-top: 24px;
                    background: white;
                    border-radius: 8px;
                    padding: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .ooda-scorecard-legend {
                    margin-top: 16px;
                    font-size: 12px;
                    color: #64748b;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 12px;
                }
                .legend-item {
                    margin-bottom: 4px;
                    line-height: 1.4;
                }
                .ooda-score-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .ooda-score-table th {
                    background: #f8fafc;
                    padding: 8px;
                    text-align: center;
                    border-bottom: 2px solid #e2e8f0;
                    color: #64748b;
                    font-weight: 600;
                }
                .ooda-score-table td {
                    padding: 12px 8px;
                    border-bottom: 1px solid #e2e8f0;
                    vertical-align: top;
                }
                .text-center { text-align: center; }
                .font-bold { font-weight: 700; }
                .font-medium { font-weight: 500; }
                
                .checklist-item {
                    margin-bottom: 6px;
                }
                .checkbox-label {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .checkbox-label:hover {
                    background: #f1f5f9;
                }
                .checkbox-label.checked .checkbox-text {
                    color: #0f172a;
                    font-weight: 500;
                }
                .checkbox-text {
                    color: #1e293b;
                    line-height: 1.4;
                    font-size: 1.05rem;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
}
