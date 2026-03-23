import { describe, it, expect } from 'vitest';
import mermaid from 'mermaid';
import { MarkdownConverter } from '@mdreview/core';

describe('Mermaid parsing with loose security', () => {
  it('should parse graph with <br/> and classDef', async () => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      flowchart: { htmlLabels: true },
    });

    const code = `graph TB
    subgraph "Layer 3: Observability"
        ALLOY["Alloy (Titan Agent)<br/>cyclops-alloy.container"]:::quadlet
    end
    classDef quadlet fill:#2ca02c,stroke:#145014,color:#ffffff`;

    const result = await mermaid.parse(code);
    expect(result).toBeTruthy();
  });

  it('should parse stateDiagram-v2 with nested state blocks', async () => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
    });

    const code = `stateDiagram-v2
    [*] --> Bare: DC team provisions hardware

    Bare --> BaseOS: base.yml<br/>packages, users, sysctl
    BaseOS --> Storage: storage.yml<br/>LVM (prod) or dirs (dev)
    Storage --> Services: services.yml

    Services --> Healthy: verify health endpoints

    Healthy --> Upgrading: New version vars
    Upgrading --> Services: services.yml

    state Healthy {
        [*] --> Prometheus_OK
        [*] --> Loki_OK
        Prometheus_OK --> Degraded: health check fail
        Loki_OK --> Degraded: health check fail
        Degraded --> Prometheus_OK: auto-restart (systemd)
    }`;

    const result = await mermaid.parse(code);
    expect(result).toBeTruthy();
  });

  it('should parse sequenceDiagram with rect blocks', async () => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
    });

    const code = `sequenceDiagram
    participant Op as Operator
    participant Ctrl as Ansible Controller
    participant Host as Cyclops Host

    Op->>Ctrl: ansible-playbook site.yml
    activate Ctrl
    Ctrl->>Host: SSH connect

    rect rgb(127, 127, 127, 0.1)
        Note over Host: Layer 1
        Ctrl->>Host: base.yml
    end

    deactivate Ctrl`;

    const result = await mermaid.parse(code);
    expect(result).toBeTruthy();
  });

  it('should survive round-trip through data-mermaid-code attribute', async () => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      flowchart: { htmlLabels: true },
    });

    const md = `\`\`\`mermaid
graph TB
    subgraph "Layer 3: Observability"
        ALLOY["Alloy (Titan Agent)<br/>cyclops-alloy.container"]:::quadlet
    end
    classDef quadlet fill:#2ca02c,stroke:#145014,color:#ffffff
\`\`\``;

    const converter = new MarkdownConverter();
    const result = converter.convert(md);

    const container = document.createElement('div');
    container.innerHTML = result.html;
    const mermaidDiv = container.querySelector('.mermaid-container');
    expect(mermaidDiv).not.toBeNull();

    const recoveredCode = mermaidDiv!.getAttribute('data-mermaid-code');
    expect(recoveredCode).toContain('graph TB');
    expect(recoveredCode).toContain('<br/>');

    const parseResult = await mermaid.parse(recoveredCode!);
    expect(parseResult).toBeTruthy();
  });

  it('should round-trip stateDiagram with curly braces through HTML attribute', async () => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
    });

    const md = `\`\`\`mermaid
stateDiagram-v2
    [*] --> Healthy
    state Healthy {
        [*] --> OK
        OK --> Degraded
    }
\`\`\``;

    const converter = new MarkdownConverter();
    const result = converter.convert(md);

    const container = document.createElement('div');
    container.innerHTML = result.html;
    const mermaidDiv = container.querySelector('.mermaid-container');
    const recoveredCode = mermaidDiv?.getAttribute('data-mermaid-code') || '';

    expect(recoveredCode).toContain('state Healthy {');
    expect(recoveredCode).toContain('}');

    const parseResult = await mermaid.parse(recoveredCode);
    expect(parseResult).toBeTruthy();
  });
});
