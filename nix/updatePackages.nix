#!/usr/bin/env sh
node2nix -12 -i ../package.json -l ../package-lock.json -d --supplement-input supplement.json --composition node2nix.nix
