use anyhow::{anyhow, Context, Result};
use blake3;
use clap::Parser;
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

/// OffSec Shield proof bundle verifier
#[derive(Parser, Debug)]
#[command(name = "offsec-proof-verify")]
#[command(about = "Verify OffSec Shield proof bundles (leaf/path/root/anchor).")]
struct Args {
    /// Path to the proof bundle JSON file. Use '-' for stdin.
    #[arg(value_name = "FILE")]
    file: String,
}

#[derive(Debug, Deserialize)]
struct PathElement {
    sibling: String,
    position: String, // "left" | "right"
}

#[derive(Debug, Deserialize)]
struct Anchor {
    root: Option<String>,
    ts: Option<String>,
    chain: Option<String>,
    txid: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProofBundle {
    leaf: String,
    path: Vec<PathElement>,
    root: String,
    #[serde(default)]
    anchor: Option<Anchor>,
    #[serde(rename = "receiptId")]
    receipt_id: Option<String>,
    #[serde(rename = "eventType")]
    event_type: Option<String>,
    ts: Option<String>,
}

fn read_bundle(path: &str) -> Result<ProofBundle> {
    let data = if path == "-" {
        use std::io::Read;
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .context("reading from stdin")?;
        buf
    } else {
        fs::read_to_string(PathBuf::from(path))
            .with_context(|| format!("reading file: {path}"))?
    };

    let bundle: ProofBundle = serde_json::from_str(&data).context("parsing JSON proof bundle")?;
    Ok(bundle)
}

fn is_hex(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn verify_merkle(bundle: &ProofBundle) -> Result<bool> {
    if !is_hex(&bundle.leaf) {
        return Err(anyhow!("leaf is not valid hex"));
    }
    if !is_hex(&bundle.root) {
        return Err(anyhow!("root is not valid hex"));
    }

    // Reconstruction: start at leaf, walk through path using BLAKE3
    let mut h = bundle.leaf.clone();

    for (i, step) in bundle.path.iter().enumerate() {
        if !is_hex(&step.sibling) {
            return Err(anyhow!(
                "path[{}].sibling is not valid hex: {}",
                i,
                step.sibling
            ));
        }

        let combined = match step.position.as_str() {
            "left" => format!("{}{}", step.sibling, h),
            "right" => format!("{}{}", h, step.sibling),
            other => return Err(anyhow!("invalid position {:?} at path[{}]", other, i)),
        };

        let digest = blake3::hash(combined.as_bytes()).to_hex().to_string();
        h = digest;
    }

    Ok(h == bundle.root)
}

fn verify_anchor(bundle: &ProofBundle) -> Result<Option<bool>> {
    if let Some(anchor) = &bundle.anchor {
        if let Some(anchor_root) = &anchor.root {
            if !is_hex(anchor_root) {
                return Err(anyhow!("anchor.root is not valid hex"));
            }
            Ok(Some(anchor_root == &bundle.root))
        } else {
            Ok(Some(false))
        }
    } else {
        Ok(None)
    }
}

fn main() -> Result<()> {
    let args = Args::parse();
    let bundle = read_bundle(&args.file)?;

    println!("== OffSec Shield Proof Verification ==");
    if let Some(id) = &bundle.receipt_id {
        println!("Receipt: {id}");
    }
    if let Some(ev) = &bundle.event_type {
        println!("Event:   {ev}");
    }
    if let Some(ts) = &bundle.ts {
        println!("Time:    {ts}");
    }
    println!("Leaf:    {}", bundle.leaf);
    println!("Root:    {}", bundle.root);
    println!("Path elements: {}", bundle.path.len());
    if let Some(anchor) = &bundle.anchor {
        println!(
            "Anchor data: root={} chain={} txid={} status={} ts={}",
            anchor.root.as_deref().unwrap_or("—"),
            anchor.chain.as_deref().unwrap_or("—"),
            anchor.txid.as_deref().unwrap_or("—"),
            anchor.status.as_deref().unwrap_or("—"),
            anchor.ts.as_deref().unwrap_or("—")
        );
    }

    let merkle_ok = verify_merkle(&bundle)?;
    println!(
        "Merkle proof: {}",
        if merkle_ok { "VALID" } else { "INVALID" }
    );

    let anchor_ok = verify_anchor(&bundle)?;
    match anchor_ok {
        Some(true) => {
            println!("Anchor:  MATCHES root");
        }
        Some(false) => {
            println!("Anchor:  DOES NOT MATCH root");
        }
        None => {
            println!("Anchor:  (no anchor info present)");
        }
    }

    if !merkle_ok {
        return Err(anyhow!("merkle proof failed"));
    }

    if let Some(false) = anchor_ok {
        return Err(anyhow!("anchor.root does not match root"));
    }

    println!("✅ Proof bundle verified successfully.");
    Ok(())
}
