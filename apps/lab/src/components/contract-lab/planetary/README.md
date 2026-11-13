# Planetary application example

This directory implements the application-owned planetary model and its controls example at `/lab/planetary`.
It is a Nexus/DashStack consumer. Solver rules, physical limits, derived results and progress remain application-owned.
Read the model source and its tests for current solver behavior; no general-purpose solver API is exported by Picodash.
Application-owned Bridge observations expose declared results without adding solver semantics to Nexus.
