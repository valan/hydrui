{
  buildNpmPackage,
  pkg-config,
  pixman,
  cairo,
  pango,
}: let
  version = builtins.readFile ../../VERSION;
in
  buildNpmPackage {
    name = "hydrui-www";
    inherit version;
    src = ./../..;

    VITE_HYDRUI_VERSION = version;

    nativeBuildInputs = [
      pkg-config
    ];

    buildInputs = [
      pixman
      cairo
      pango
    ];

    npmDepsHash = "sha256-AYrmMOsZKkDsLnNKxii023JG6u93w+f2oHfDg/ImouU=";

    buildPhase = ''
      npm run --workspaces build
      npm run --workspace web/hydrui-util pack
    '';

    installPhase = ''
      mkdir -p $out/share/hydrui/internal/webdata
      cp internal/webdata/*.pack $out/share/hydrui/internal/webdata
    '';
  }
