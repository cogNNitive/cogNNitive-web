'use strict';

/**
 * Producer payloads (change-provenance A9): a producer that writes an artifact
 * prints a ready `propose_changeset` payload with exactly one `produce_artifact`
 * change. It NEVER applies: apply stays in nn-mcp, behind the lock and the seal.
 *
 * `ARTIFACT_WITHOUT_RECORD` is the backstop when nobody applies the payload.
 */

/**
 * @param {{ artifactPath: string, evidence: string, author: string }} input
 * @returns {{ tool: 'propose_changeset', arguments: { operations: Array<{ op: 'produce_artifact', target: string, evidence: string, author: string }> } }}
 */
function buildProduceArtifactPayload({ artifactPath, evidence, author }) {
  const target = String(artifactPath).replace(/\\/g, '/');
  return {
    tool: 'propose_changeset',
    arguments: {
      operations: [
        {
          op: 'produce_artifact',
          target,
          evidence: String(evidence).replace(/\\/g, '/'),
          author,
        },
      ],
    },
  };
}

/** Prints the payload on its own marked block, so a human and a test can find it. */
function printProduceArtifactPayload(payload) {
  console.log('');
  console.log('propose_changeset payload (produce_artifact):');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  console.log('This is a ready payload. Apply it through apply_change; nothing was applied here.');
}

module.exports = { buildProduceArtifactPayload, printProduceArtifactPayload };
