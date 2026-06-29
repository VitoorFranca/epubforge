fn main() {
    tauri_build::build();

    // Capture the workspace node_modules path at build time so the release binary
    // can set NODE_PATH when spawning the production sidecar (prod.cjs).
    // CARGO_MANIFEST_DIR = desktop/src-tauri/ → workspace root is two levels up.
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let workspace_root = std::path::Path::new(&manifest_dir)
        .parent()
        .unwrap() // desktop/
        .parent()
        .unwrap(); // epubforge/
    let node_modules = workspace_root.join("node_modules");
    let node_modules_str = node_modules.to_string_lossy();
    println!("cargo:rustc-env=EPUBFORGE_NODE_MODULES={node_modules_str}");
    println!("cargo:rerun-if-changed=../../package-lock.json");
}
