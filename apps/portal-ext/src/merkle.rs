use blake3;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerklePathElement {
    pub sibling: String,
    pub position: String, // "left" | "right"
}

/// Simple in-memory frontier for building roots and paths.
/// For larger logs this could be swapped for a streaming/stack-based frontier.
#[derive(Debug, Clone, Default)]
pub struct MerkleFrontier {
    pub leaves: Vec<String>,
}

impl MerkleFrontier {
    pub fn new() -> Self {
        Self { leaves: Vec::new() }
    }

    pub fn append_with_path(&mut self, leaf_hex: String) -> (String, Vec<MerklePathElement>) {
        self.leaves.push(leaf_hex.clone());
        self.build_path_for_index(self.leaves.len() - 1)
    }

    pub fn current_root(&self) -> String {
        if self.leaves.is_empty() {
            return "0".repeat(64);
        }
        let (_, root) = self.build_tree();
        root
    }

    fn build_tree(&self) -> (Vec<Vec<String>>, String) {
        let mut levels = Vec::new();
        if self.leaves.is_empty() {
            return (levels, "0".repeat(64));
        }

        let mut current = self.leaves.clone();
        levels.push(current.clone());

        while current.len() > 1 {
            let mut next = Vec::new();
            for chunk in current.chunks(2) {
                let combined = if chunk.len() == 2 {
                    format!("{}{}", chunk[0], chunk[1])
                } else {
                    // duplicate the last node when odd length
                    format!("{}{}", chunk[0], chunk[0])
                };
                let h = blake3::hash(combined.as_bytes()).to_hex().to_string();
                next.push(h);
            }
            current = next.clone();
            levels.push(current.clone());
        }

        let root = current[0].clone();
        (levels, root)
    }

    fn build_path_for_index(&self, index: usize) -> (String, Vec<MerklePathElement>) {
        let (levels, root) = self.build_tree();
        if self.leaves.is_empty() || index >= self.leaves.len() {
            return (root, Vec::new());
        }

        let mut path = Vec::new();
        let mut idx = index;

        for level_nodes in levels.iter() {
            if level_nodes.len() == 1 {
                break;
            }

            let is_right = idx % 2 == 1;
            let sibling_idx = if is_right {
                idx.saturating_sub(1)
            } else {
                idx + 1
            };

            if sibling_idx < level_nodes.len() {
                let sibling = level_nodes[sibling_idx].clone();
                let position = if is_right { "left" } else { "right" }.to_string();
                path.push(MerklePathElement { sibling, position });
            } else {
                // odd end node; sibling is the node itself
                let sibling = level_nodes[idx].clone();
                let position = if is_right { "left" } else { "right" }.to_string();
                path.push(MerklePathElement { sibling, position });
            }

            idx /= 2;
        }

        (root, path)
    }
}
