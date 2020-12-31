{pkgs ? import <nixpkgs> {
  inherit system;
}, system ? builtins.currentSystem}:

let
  nodePackages = import ./node2nix.nix {
    inherit pkgs system;
  };
in
nodePackages // {
  shell = nodePackages.shell.override {
    buildInputs = (with pkgs; [pkg-config cairo pango libpng libjpeg giflib gcc libuuid]) ++ nodePackages.shell.buildInputs;
  };
}
